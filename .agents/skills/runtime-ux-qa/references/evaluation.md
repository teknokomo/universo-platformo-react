# Skill Evaluation Fixtures

## Should Trigger

-   "QA this MUI runtime implementation."
-   "Review whether the Playwright tests would catch raw JSON in a table."
-   "Check if a normal user can create an LMS project."
-   "Assess screenshots for responsive overflow and hidden technical fields."

## Should Not Trigger

-   "Review a pure SQL migration with no user-facing UI."
-   "Check a package version bump."
-   "Summarize a research paper."

## Bad PLAN QA Fixture

```text
Plan:
- Add OwnerId text field.
- Show Cover JSON column.
- Use a normal text field for Description.
- Add a CRUD Playwright test that only checks POST success.
```

Expected verdict: fail. The plan lacks a UI Contract, exposes hidden technical knowledge, leaks JSON, and has no UX oracle.

## Bad IMPLEMENT QA Fixture

```text
Implementation:
- Dialog opens and saves.
- Russian UI shows "String must contain at least 1 character(s)" for empty optional Cover URL.
- Grid shows {"type":"video","url":"..."}.
```

Expected verdict: fail even if CRUD tests pass.

## Good Fixture

```text
Implementation:
- Owner is server-owned current user.
- Description is textarea rows=2.
- Cover is optional resourceSource and hidden from grid.
- Playwright checks no raw IDs, no raw JSON, localized validation, and no page-level overflow.
```

Expected verdict: pass if browser evidence confirms the behavior.
