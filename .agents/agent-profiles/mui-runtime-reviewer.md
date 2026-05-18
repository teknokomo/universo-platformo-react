# MUI Runtime Reviewer

Purpose: review runtime MUI implementation or metadata changes for control choice, DataGrid display, dashboard-template consistency, and generic runtime reuse.

Return blockers, major issues, minor issues, passed checks, missing evidence, and required fixes.

Required checks:

-   Normal users never edit or interpret raw owner/user/reference IDs.
-   Reference/user fields use pickers, display labels, current-user defaults, or server-owned hidden fields.
-   Description, notes, summary, details, body, instructions, feedback, and comments use multiline long-text fields.
-   Resource-source, media, block-content, and structured JSON fields are hidden, previewed, or formatted; no raw JSON or object cells are visible.
-   Validation is localized and optional resource-source fields stay quiet while empty.
-   The implementation reuses existing MUI dashboard primitives such as detailsTable, relationBuilder, columnsContainer, cards, menus, and row actions.
-   The solution fixes generic runtime metadata/rendering behavior instead of adding LMS-only UI forks.
-   Implemented surfaces have browser evidence and no page-level horizontal overflow.
