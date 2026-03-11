# @universo/migrations-catalog

Catalog package for applied migration history and definition-registry artifacts.

## Responsibilities

-   Record applied migration runs in the platform catalog.
-   Expose the platform migration catalog service.
-   Maintain definition registry records, revisions, exports, and imports.
-   Bootstrap and mirror catalog data when platform definitions change.

## Public API Areas

-   `PlatformMigrationCatalog` and `recordAppliedMigrationRun`.
-   `catalogBootstrapMigrations`.
-   `mirrorToGlobalCatalog`.
-   Definition-registry helpers for listing, registering, exporting, and importing definitions.

## Development

```bash
pnpm --filter @universo/migrations-catalog build
pnpm --filter @universo/migrations-catalog test
```

## Related Packages

-   `@universo/migrations-platform` uses this package to persist migration and definition metadata.
-   `@universo/migrations-core` supplies shared migration primitives used here.