# Active Context

> **Last Updated**: 2026-03-07
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus

Completed the PR #714 follow-up pass for **bot feedback validation + remaining mobile layout polish**.

### Latest Completed Work (2026-03-07)

- Reviewed all PR #714 bot comments/reviews and fixed only the findings that were confirmed by the live code and MUI documentation.
- Added an accessible name to the mobile icon-only delete button in `EntityFormDialog`.
- Translated the three QA plan documents in `memory-bank/plan/` to fully English content to restore memory-bank compliance.
- Updated `ViewHeader` mobile layout so the search button stays left, action buttons stay right, and vertical spacing is consistent around the header/action block.
- Widened `SideMenuMobile` by setting the actual drawer paper width instead of only constraining the inner stack.
- Switched `MenuWidgetEditorDialog` catalog loading from a hard `limit: 200` request to `fetchAllPaginatedItems()` for consistency with other large-metahub selectors.
- Verification completed: touched-package lint reruns produced warnings only, touched-package tests completed successfully, and `pnpm build` finished 23/23.

### Previous Completed Work

- Fixed i18n `createOptions` namespace consolidation
- Fixed Hub Settings tab (`hubMap` → `allHubsById` lookup)
- Improved mobile UX: ViewHeader spacing, search button, wider drawer, responsive delete button
- Breadcrumb query invalidation in all 5 entity settings dialogs

### Next Focus Candidates

- Await the user's manual re-test of PR #714 mobile layout on real devices / responsive emulation
- Push or amend the PR branch once the user approves the follow-up fixes
- Continue with Constants / REF display debt items in `tasks.md`

### Notes

- Touched-package lint reruns still report pre-existing warnings, but no new lint errors were introduced by the PR #714 follow-up pass.
- `ViewHeader` now uses a dedicated right-aligned controls group on mobile so search can stay left while the remaining controls stay right.
- `SideMenuMobile` width must be controlled on the drawer paper itself; changing only the inner stack width is not sufficient.
- `MenuWidgetEditorDialog` was the remaining catalogs selector still using a fixed page limit after the earlier all-pages loading hardening.
