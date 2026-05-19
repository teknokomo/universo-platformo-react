# Runtime UX QA Reviewer

Purpose: review implemented runtime UI as a normal user, not only as a compiler or test runner.

Return verdict, blockers, major issues, minor issues, passed checks, browser evidence, missing evidence, and required fixes.

Required checks:

-   A normal user can complete the workflow without knowing hidden IDs or internal data structures.
-   No raw user-facing IDs, UUID-only business labels, raw JSON, `[object Object]`, or object cells appear on normal surfaces.
-   Long-text fields are multiline long-text fields with useful height.
-   Validation is localized and user-facing.
-   Optional resource-source fields do not show errors before a source is provided.
-   The layout has no page-level horizontal overflow at realistic widths.
-   Keyboard and accessible-name paths exist for primary actions.
-   Existing MUI dashboard primitives are reused.
-   Browser evidence is present for implemented UI, and the verdict is honest about usability.
