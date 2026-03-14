# Applications Backend — Migration System

> Current package-local explanation of how the fixed `applications` system app and managed runtime application schemas reach the database. For the general package overview see [README.md](README.md).

## Current Principle

`applications` is a fixed system app and also a separate application-like domain inside the platform.
The long-term target is to author the same baseline through metahubs, but that authoring flow is not complete yet.
For now the team keeps a manually curated snapshot-equivalent baseline, codifies it in the system-app manifest plus companion SQL migration files, and lets platform bootstrap materialize it on first start.

## Source Of Truth

| Source | Role |
| --- | --- |
| `src/platform/systemAppDefinition.ts` | Canonical fixed-schema business model for the `applications` system app |
| `src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts` | Canonical file-backed SQL artifact that keeps the fixed-schema parity contract explicit |
| `prepareApplicationsSchemaSupportMigrationDefinition` | `pre_schema_generation` support SQL that runs before fixed-schema generation |
| `finalizeApplicationsSchemaSupportMigrationDefinition` | `post_schema_generation` support SQL that runs after fixed-schema generation |

## First-Start Bootstrap

On platform startup `@universo/core-backend` runs the fixed system-app pipeline for `applications`:

1. Platform prelude migrations run the `pre_schema_generation` support SQL for the schema.
2. `ensureRegisteredSystemAppSchemaGenerationPlans()` builds fixed application-like entities from the manifest and ensures the `applications` schema shape.
3. Platform post-schema migrations run the `post_schema_generation` support SQL for indexes, policies, and other dependent objects.
4. `bootstrapRegisteredSystemAppStructureMetadata()` syncs `_app_objects` and `_app_attributes` metadata for the fixed schema.
5. A deterministic baseline row such as `baseline_applications_structure_0_1_0` is stored in `applications._app_migrations`.

## Fixed Schema Surface

The fixed `applications` schema is the platform catalog for application metadata, not the per-application runtime schema.
The current manifest defines these business tables:

- `cat_applications`
- `cat_connectors`
- `rel_connector_publications`
- `rel_application_users`

The current fixed-schema system-table surface comes from the enabled application-like capabilities:

- `_app_migrations`
- `_app_settings`
- `_app_objects`
- `_app_attributes`

## Runtime Application Schemas

Each managed application still gets its own dynamic runtime schema named `app_<uuid32>`.
Those runtime schemas are created or upgraded by the application sync engine, not by the fixed `applications` schema bootstrap.
When a runtime schema exists, the canonical shared system-table set is:

- `_app_migrations`
- `_app_settings`
- `_app_objects`
- `_app_attributes`
- `_app_values`
- `_app_layouts`
- `_app_widgets`

There is no current `_app_metadata` system table in the shared schema-ddl contract.

## Routes Owned By This Package

`@universo/applications-backend` owns the runtime orchestration endpoints:

- `POST /application/:applicationId/sync`
- `GET /application/:applicationId/release-bundle`
- `POST /application/:applicationId/release-bundle/apply`
- `GET /application/:applicationId/diff`

These routes create or update the managed runtime schema, persist `schema_status`, `schema_snapshot`, and `installed_release_metadata` in `applications.cat_applications`, and reuse the same sync engine for publication-backed and file-bundle installs.

## Related Migration-Control Routes

The migration guard and migration history endpoints for runtime applications are currently mounted by `@universo/metahubs-backend`, not by this package:

- `GET /application/:applicationId/migrations/status`
- `GET /application/:applicationId/migrations`
- `GET /application/:applicationId/migration/:migrationId`
- `GET /application/:applicationId/migration/:migrationId/analyze`
- `POST /application/:applicationId/migration/:migrationId/rollback`

This split is intentional: `@universo/applications-backend` owns runtime sync and release-bundle execution, while `@universo/metahubs-backend` still hosts the migration-control surface used by the current authoring flow.

## Practical Reading

Read this file as the package-local explanation of how the applications system app reaches the database today.
The baseline starts from a manually curated snapshot-equivalent model, platform bootstrap materializes the fixed schema on first start, and later runtime application schemas evolve through sync, diff, and release-bundle flows.
