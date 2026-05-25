# @universo-react/template-mui

Shared Material UI package for the current Universo Platformo React shell.

## Overview

This package contains the reusable layout, dashboard, dialog, table, pagination, navigation, and optimistic-CRUD UI building blocks used across frontend modules.
It is the shared presentation layer for the current React shell, not a standalone business module.

## Package Surface

-   `MainLayoutMUI` and `MainRoutesMUI` provide the shared layout and route shell.
-   Dashboard exports such as `Dashboard`, `StatCard`, and `HighlightedCard` provide common page composition primitives.
-   Dialog, table, selection, pagination, and card components are re-exported from the package root.
-   Editor.js block-content authoring is re-exported from the neutral `@universo-react/block-editor` package so administrative and published-app flows share one implementation.
-   Layout presentation helpers such as `LayoutStateChips` and `LayoutAuthoringDetails` keep metahub and application layout screens aligned while leaving routing, labels, data loading, and widget-specific dialogs in consumer packages.
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

## Related Documentation

-   [Main package index](../../../packages/README.md)
-   [Core frontend shell](../universo-react-core-frontend/README.md)
-   [Shared i18n runtime](../universo-react-i18n/README.md)
-   [Shared domain types](../universo-react-types/README.md)

---

Universo Platformo | Shared MUI package
