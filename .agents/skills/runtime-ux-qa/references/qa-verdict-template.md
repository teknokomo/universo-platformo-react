# Runtime UX QA Verdict Template

```markdown
## Verdict

verdict: pass | pass-with-minor-issues | fail

## Blockers

-   [file/screen/reference] Issue and user impact.

## Major Issues

-   [file/screen/reference] Issue and user impact.

## Minor Issues

-   [file/screen/reference] Issue and user impact.

## Passed Checks

-   No raw user-facing IDs.
-   No raw JSON/object cells.
-   Long-text fields are multiline.
-   Validation is localized.
-   No page-level horizontal overflow.
-   Existing MUI dashboard/template primitives are reused.

## Browser Evidence

-   Screens/flows checked.
-   Viewports checked.
-   Screenshots or traces reviewed.

## Missing Evidence

-   Anything that could not be verified.

## Required Fixes

-   Concrete changes required before the work is accepted.
```

QA must explicitly answer whether a normal user can complete the workflow without hidden technical knowledge.
