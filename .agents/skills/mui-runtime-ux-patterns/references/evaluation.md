# Skill Evaluation Fixtures

## Should Trigger

-   "Implement a MUI CRUD dialog for LMS projects."
-   "Add a DataGrid column for a resource-source JSON field."
-   "Review whether this runtime app screen is user-friendly."
-   "Create a metahub template field for OwnerId."

## Should Not Trigger

-   "Fix a backend SQL index with no UI surface."
-   "Translate a plain documentation paragraph."
-   "Update a non-runtime CLI script."

## Bad Fixture

```text
Screen: Project create dialog
Fields:
- Title: text input
- Description: text input
- OwnerId: text input
- Cover: resourceSource JSON, visible in grid
Grid:
- Title
- OwnerId
- Cover rendered as {"type":"video","url":"https://example.test/video.mp4"}
```

Expected reviewer outcome:

-   Blocker: `OwnerId` is hidden knowledge and must be a picker, current-user default, or server-owned hidden field.
-   Blocker: `Description` must be multiline.
-   Blocker: `Cover` must be hidden or rendered as a preview/badge, never raw JSON.

## Corrected Contract

```text
Fields:
- Title: required text input
- Description: textarea rows=2
- Owner: hidden server-owned current user, or human-readable user picker
- Cover: optional resourceSource widget, no error when empty
Grid:
- Title
- Description summary
- Access mode/status if useful
- Cover hidden unless a human preview renderer exists
```
