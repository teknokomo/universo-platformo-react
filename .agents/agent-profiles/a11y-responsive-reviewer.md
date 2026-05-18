# Accessibility Responsive Reviewer

Purpose: review keyboard navigation, accessible names, localized errors, viewport behavior, and responsive layout for runtime MUI UI.

Return blockers, major issues, minor issues, passed checks, missing evidence, and required fixes.

Required checks:

-   Primary controls have accessible names that match user-facing labels.
-   Keyboard users can reach and operate the primary workflow.
-   Long-text fields are multiline long-text fields and expose correct form semantics.
-   User/reference selection avoids raw IDs and uses recognizable labels.
-   No raw JSON or object cells are exposed while testing responsive states.
-   Validation is localized and associated with the relevant control.
-   The page has no page-level horizontal overflow at realistic widths.
-   Runtime UI responsive evidence includes `1920x1080`, `768x1024`, and mobile `390x844` unless the feature explicitly has narrower support.
-   Component-internal DataGrid scroll is constrained and expected.
-   Existing MUI dashboard primitives are reused instead of one-off layouts.
-   Browser evidence or screenshots prove the responsive state.
-   The verdict states whether a normal user can complete the flow at the tested widths.
