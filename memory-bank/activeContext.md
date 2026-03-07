# Active Context

> **Last Updated**: 2026-03-07
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus

Completed the final QA debt closure for **Metahub Create Options + Entity Settings + Mobile UX + Logout**.

### Latest Completed Work (2026-03-07)

- Reworked `ViewHeader` mobile search so collapsing the overlay preserves the active value instead of clearing the filter.
- Added controlled `searchValue` support in `ViewHeader` with an internal fallback state to keep backward compatibility for existing callers.
- Wired `PublicationVersionList` to pass `searchValue` and extracted `invalidatePublicationSettingsQueries()` for consistent publication detail/list/breadcrumb refresh behavior.
- Added focused regression coverage for mobile search persistence/parent sync and publication settings invalidation.
- Verification completed: `@universo/template-mui` tests passed (13 suites / 175 tests), focused publication invalidation Vitest passed, full `@universo/metahubs-frontend` suite re-ran successfully, and `pnpm build` finished 23/23.

### Previous Completed Work

- Fixed i18n `createOptions` namespace consolidation
- Fixed Hub Settings tab (`hubMap` → `allHubsById` lookup)
- Improved mobile UX: ViewHeader spacing, search button, wider drawer, responsive delete button
- Breadcrumb query invalidation in all 5 entity settings dialogs

### Next Focus Candidates

- Await user's manual re-test of the fully closed QA scope
- Continue with Constants / REF display debt items in `tasks.md`

### Notes

- Touched-package lint reruns still report pre-existing warnings, but no new lint errors were introduced by this closure pass.
- `ViewHeader` now supports both controlled (`searchValue`) and uncontrolled fallback search state.
- The breadcrumb hook queries use separate `['breadcrumb', ...]` keys from the domain query keys — this pattern must be maintained for future entity types
- All 5 entity types with Settings dialogs now have breadcrumb invalidation: catalogs, sets, enumerations, hubs, publications
