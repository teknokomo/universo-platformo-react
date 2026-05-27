# Browser Game Runtime QA Evidence Template

Use this structure when reporting QA for browser 3D/game runtime surfaces.

```markdown
verdict: pass | pass-with-minor-issues | fail

blockers:

-   ...

majorIssues:

-   ...

minorIssues:

-   ...

passedChecks:

-   Canvas visible, bounded, and nonblank.
-   Viewport matrix checked: 1920x1080, 768x1024, 390x844.
-   No document-level horizontal overflow.
-   Keyboard path and focus exit verified.
-   No raw IDs/JSON/protocol leakage.
-   Localized user-facing states verified.
-   Localized validation verified where forms/dialogs exist.
-   Semantic long-text fields use multiline controls where present.
-   Optional resource-source fields stay quiet before a source is selected.
-   Existing apps-template-mui/MUI primitives reused, or a product reason for a
    new primitive is documented.

browserEvidence:

-   Screenshot/trace paths.
-   Playwright spec or command.
-   Viewports covered.

missingEvidence:

-   ...

requiredFixes:

-   ...
```

Screenshots are useful, but report the assertions that make them meaningful.
