# @universo-react/template-mui

Shared Material UI package for the current Universo Platformo React shell.

## Overview

This package contains the reusable layout, dashboard, dialog, table, pagination, navigation, dropdown, and optimistic-CRUD UI building blocks used across frontend modules.
It is the shared presentation layer for the current React shell, not a standalone business module.

## Package Surface

-   `MainLayoutMUI` and `MainRoutesMUI` provide the shared layout and route shell.
-   Dashboard exports such as `Dashboard`, `StatCard`, and `HighlightedCard` provide common page composition primitives.
-   Dialog, table, selection, pagination, and card components are re-exported from the package root.
-   `DropdownSelect` preserves MUI `Select` behavior for closed option sets, including `MenuItem` children, multiple selection, `renderValue`, and caller-owned empty/reset options. `DropdownAutocomplete` standardizes searchable dropdown controls and their clear/open buttons, while optional `endActions` supports localized reset and related actions. Import them from `@universo-react/template-mui/dropdowns` for the focused shared-controls entry point, or from the package root when already using other template components.
-   Editor.js block-content authoring is re-exported from the neutral `@universo-react/block-editor` package so administrative and published-app flows share one implementation.
-   Layout presentation helpers such as `LayoutStateChips` and `LayoutAuthoringDetails` keep metahub and application layout screens aligned while leaving routing, labels, data loading, and widget-specific dialogs in consumer packages.
-   `LayoutAuthoringDetails` provides generic zone actions and grouped placement metadata, while `LayoutZoneSettingsDialog` renders registry-backed settings such as fixed/flow positioning with inherited, customized, reset, optimistic-concurrency, read-only, and focus behavior.
-   Factory helpers such as `createEntityActions()` and `createMemberActions()` reduce repeated CRUD-action wiring.
-   Hooks such as `usePaginated()`, `useDebouncedSearch()`, `useUserSettings()`, `useListDialogs()`, and optimistic CRUD helpers support common frontend flows.

## Integration Role

-   The package is consumed by frontend modules such as auth, onboarding, admin, profile, metahubs, and applications.
-   It depends on shared frontend contracts from `@universo-react/block-editor`, `@universo-react/i18n`, `@universo-react/types`, `@universo-react/utils`, and `@universo-react/store`.
-   It is built as a reusable package with dual JavaScript output and generated type declarations.
-   It should remain domain-neutral: business wording and route semantics belong in consumer packages, not in the shared template layer.

## Development Notes

```bash
pnpm --filter @universo-react/template-mui build
pnpm --filter @universo-react/template-mui lint
pnpm --filter @universo-react/template-mui test
```

-   Keep exported components generic and reusable across multiple frontend modules.
-   Add new translation keys through shared or consumer namespaces with EN/RU parity.
-   Prefer documenting package-level responsibilities here and module-specific workflows in consumer package READMEs.
-   Use the shared dropdown controls in non-published host/admin surfaces. Keep `@universo-react/apps-template-mui` self-contained for published applications.
-   `DropdownImportBoundary.test.ts` checks that package UI code does not import MUI `Select` or `Autocomplete` directly outside the shared controls; the published app template remains excluded by design.
-   Shared layout components consume serializable metadata and typed callbacks. Consumer packages own routes, permissions, queries, cache invalidation, and server error presentation.

## Related Documentation

-   [Main package index](../../../packages/README.md)
-   [Core frontend shell](../universo-react-core-frontend/README.md)
-   [Shared i18n runtime](../universo-react-i18n/README.md)
-   [Shared domain types](../universo-react-types/README.md)

---

Universo Platformo | Shared MUI package
