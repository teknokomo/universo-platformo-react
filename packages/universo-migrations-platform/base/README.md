# @universo/migrations-platform

Platform-wide migration registry and CLI-facing orchestration package.

## Responsibilities

-   Register platform migration definitions.
-   Plan, run, diff, export, and validate registered platform migrations.
-   Adapt SQL definitions into the platform migration runtime.
-   Expose the CLI entry points used by root migration commands.

## Public API Areas

-   `createPlatformMigrationFromSqlDefinition`.
-   `platformMigrations` registry export.
-   Planning, execution, diff, export, and validation helpers.
-   CLI integration through the package build output.

## Development

```bash
pnpm --filter @universo/migrations-platform build
pnpm --filter @universo/migrations-platform test
```

## Related Packages

-   Root workspace scripts such as `pnpm migration:status` and `pnpm migration:plan` rely on this package.
-   The package coordinates backend migration definitions together with the catalog and core migration runtimes.