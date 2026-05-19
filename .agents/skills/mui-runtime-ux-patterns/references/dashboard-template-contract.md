# Dashboard Template Contract

Published apps should feel like the existing MUI dashboard template, with real runtime data replacing demo data.

## Reuse First

Prefer existing primitives before adding new UI:

-   `detailsTable` for runtime object lists;
-   `relationBuilder` for parent-scoped child authoring;
-   `columnsContainer` for dashboard columns;
-   cards and metric widgets for summary information;
-   row actions and menus for record operations;
-   workspace switcher and workspace pages for workspace-scoped behavior;
-   `ResourcePreview` and resource-source metadata for media/link preview.

## Layout Rules

-   Do not introduce LMS-only widgets for generic list, card, picker, preview, or relation-builder needs.
-   Avoid nested cards and decorative page sections.
-   Page-level horizontal overflow is a blocker; component-internal DataGrid scroll is allowed when constrained.
-   Dense builder surfaces should reflow or stack at narrower widths.
-   Screens must remain usable in Russian and English.

## Acceptance Checklist

-   [ ] The UI uses existing app-template primitives where possible.
-   [ ] Demo-only widgets are not revived for product runtime flows.
-   [ ] Relation-builder flows keep children scoped to the selected parent.
-   [ ] The screen has browser evidence at realistic widths.
-   [ ] The visual structure matches the dashboard template style.
