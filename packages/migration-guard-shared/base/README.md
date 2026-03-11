# @universo/migration-guard-shared

Shared frontend-oriented package for migration-status UX and reusable guard helpers.

## Responsibilities

-   Provide pure helpers for migration severity and shared query options.
-   Expose a reusable `MigrationGuardShell` React component.
-   Keep migration-guard UI behavior consistent across metahub and application flows.
-   Offer a package-neutral surface that can be reused by multiple frontend modules.

## Public API

-   `determineSeverity` and its option types.
-   `MIGRATION_STATUS_QUERY_OPTIONS`.
-   `MigrationGuardShell` and its related prop and context types.

## Development

```bash
pnpm --filter @universo/migration-guard-shared build
```

## Related Packages

-   Frontend packages with migration-guard screens reuse this package.
-   The package depends on shared `@universo/types` and `@universo/utils` contracts.