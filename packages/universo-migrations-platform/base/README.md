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

## System App Schema Management

The package includes the `systemAppSchemaCompiler` which drives schema
generation for all four fixed system apps (admin, profiles, metahubs,
applications). Each system app delivers a `SystemAppDefinition` manifest;
the compiler converts `targetBusinessTables` into `EntityDefinition[]`
via `buildSystemAppBusinessEntities()`, diffs against the last recorded
snapshot, and applies only the necessary DDL.

Key functions:

-   `upgradeSystemAppSchemaGenerationPlan()` — incremental diff + apply.
-   `ensureSystemAppSchemaGenerationPlan()` — start-up entry point; skips if schema is up to date.
-   `applySystemAppSchemaGenerationPlan()` — full re-generation (used by CLI).

See [System App Migration Lifecycle](../../../docs/en/architecture/system-app-migration-lifecycle.md)
for the complete architecture description.

## CLI Commands

The following CLI commands are exposed through the root workspace scripts:

| Command                          | Description                                       |
|----------------------------------|---------------------------------------------------|
| `system-app-schema-plan`         | Show pending schema changes without applying them  |
| `system-app-schema-apply`        | Apply a full (re-)generation of system app schemas |
| `system-app-schema-bootstrap`    | Reset and bootstrap system app schemas from scratch|
| `doctor`                         | Validate migration state and metadata integrity    |

## Development

```bash
pnpm --filter @universo/migrations-platform build
pnpm --filter @universo/migrations-platform test
```

## Related Packages

-   Root workspace scripts such as `pnpm migration:status` and `pnpm migration:plan` rely on this package.
-   The package coordinates backend migration definitions together with the catalog and core migration runtimes.