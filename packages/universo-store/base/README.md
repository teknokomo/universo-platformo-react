# @universo/store

Shared Redux and ability-helper package used by the current Universo Platformo React shell.

## Overview

This package re-exports the shared store instance, legacy action and constant modules, and CASL/global-access React helpers that are still consumed by `@universo/core-frontend`.

It should be treated as a compatibility-oriented shared UI package, not as the place for new feature-specific business state when a dedicated frontend package is a better fit.

## Public Surface

-   `store` and `persister` from the shared Redux setup.
-   Re-exports of action and constant modules.
-   `AbilityContext`, `AbilityContextProvider`, and `useAbility`.
-   `Can`, `Cannot`, and `useHasGlobalAccess` helper exports.

## Source Layout

-   `src/actions.js` and `src/constant.js` define shared action names and constants.
-   `src/index.jsx` and `src/reducer.jsx` assemble the Redux store.
-   `src/context/` contains CASL-related and global-access React helpers.

## Development

```bash
pnpm --filter @universo/store build
```

## Related Packages

-   `@universo/core-frontend` consumes this package directly.
-   Other frontend packages can reuse the exported helpers when they integrate with the shared shell.