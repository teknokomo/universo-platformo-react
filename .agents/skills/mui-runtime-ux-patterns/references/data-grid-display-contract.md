# DataGrid Display Contract

Use this contract for MUI DataGrid, details tables, cards, and any metadata-generated list.

## Display Strategy

-   Prefer `valueGetter` when the displayed value is derived from row data and should participate in sorting/filtering.
-   Prefer `valueFormatter` when the raw scalar value only needs formatting for display.
-   Use `renderCell` when the cell needs React content such as chips, links, previews, avatars, badges, or action buttons.
-   Use `gridHidden` or a column visibility model for fields that are useful for persistence but not useful to users.
-   Use REF display labels for references. Do not display bare target IDs when labels are available.

## Technical Leakage

These are defects on normal user-facing surfaces:

-   JSON-like text such as `{"type":"video","url":...}`;
-   arrays or objects rendered as `[object Object]`;
-   UUID-only business labels;
-   internal field names such as `OwnerId`, `AssignedUserId`, `SourceJson`, or `resource_source`;
-   storage descriptors, Editor.js documents, and resource-source payloads shown as table content;
-   raw validation phrases such as `String must contain at least`.

`formatRuntimeValue()` and `JSON.stringify()` fallbacks can stay useful for diagnostics, but they are not a user-facing UX contract for media/resource/content fields.

## Acceptance Checklist

-   [ ] Every visible column has a human-readable purpose.
-   [ ] Structured fields are hidden or rendered as badges/previews.
-   [ ] Reference columns show display values, not bare IDs.
-   [ ] Diagnostic/internal columns are admin/debug-only or hidden.
-   [ ] Horizontal scrolling is constrained to the table component, not the whole page.
