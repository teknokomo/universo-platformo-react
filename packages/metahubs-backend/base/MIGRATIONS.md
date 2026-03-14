# Metahubs Backend — Migration System

> Current package-local explanation of how the fixed `metahubs` system app, metahub branch runtime schemas, and related application migration-control routes work today. For the general package overview see [README.md](README.md).

## Current Principle

`metahubs` is a fixed system app for design-time metadata and also the package that still hosts the current migration-control surface.
The long-term target is to author more of this model directly through metahubs themselves, but that flow is not complete yet.
For now the baseline is maintained as a manually curated snapshot-equivalent model, turned into the system-app manifest plus file-backed SQL migrations, and materialized by platform bootstrap on first start.

## Source Of Truth

| Source | Role |
| --- | --- |
| `src/platform/systemAppDefinition.ts` | Canonical fixed-schema business model for the `metahubs` system app |
| `src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts` | Canonical file-backed SQL artifact that keeps the fixed-schema parity contract explicit |
| `prepareMetahubsSchemaSupportMigrationDefinition` | `pre_schema_generation` support SQL that runs before fixed-schema generation |
| `finalizeMetahubsSchemaSupportMigrationDefinition` | `post_schema_generation` support SQL that runs after fixed-schema generation |
| `seedBuiltinTemplatesMigration` | Post-schema platform migration that seeds the built-in metahub templates |

## First-Start Bootstrap

On platform startup `@universo/core-backend` runs the fixed system-app pipeline for `metahubs`:

1. Platform prelude migrations run the `pre_schema_generation` support SQL for the schema.
2. `ensureRegisteredSystemAppSchemaGenerationPlans()` builds fixed application-like entities from the manifest and ensures the `metahubs` schema shape.
3. Platform post-schema migrations run the `post_schema_generation` support SQL and the built-in template seed migration.
4. `bootstrapRegisteredSystemAppStructureMetadata()` syncs `_app_objects` and `_app_attributes` metadata for the fixed schema.
5. A deterministic baseline row such as `baseline_metahubs_structure_0_1_0` is stored in `metahubs._app_migrations`.

## Fixed Schema Surface

The fixed `metahubs` schema stores design-time metadata, template registry data, and publication metadata.
Representative business tables defined by the manifest include:

- `cat_metahubs`
- `cat_metahub_branches`
- `rel_metahub_users`
- `cat_templates`
- `doc_template_versions`
- `cat_publications`
- `doc_publication_versions`

The fixed-schema system-table surface follows the enabled application-like capabilities for this system app and is tracked through local `_app_*` metadata tables.

## Branch Runtime Migrations

Each metahub branch still owns its own managed runtime schema named `mhb_<uuid32>_bN`.
Those branch schemas are versioned separately from the fixed `metahubs` schema and use the metahub-specific runtime history table `_mhb_migrations`.
The current numeric branch structure version is `1`, and the public semver label is `0.1.0`.

The runtime migration engine for branches keeps these rules:

- `calculateSystemTableDiff()` compares the stored branch structure version against the current system-table definition set.
- `SystemTableMigrator` applies additive DDL changes and records them in `_mhb_migrations`.
- PostgreSQL advisory locks serialize apply operations for the same branch schema.
- Template seed migrations add new layouts, widgets, settings, and related metadata without overwriting user-customized rows.

## Metahub Migration Routes

`@universo/metahubs-backend` owns the branch migration endpoints:

- `GET /metahub/:metahubId/migrations/status`
- `GET /metahub/:metahubId/migrations`
- `POST /metahub/:metahubId/migrations/plan`
- `POST /metahub/:metahubId/migrations/apply`

These routes compute blockers, structure upgrades, template upgrades, and apply plans for the selected branch.
Severity is derived through the shared `determineSeverity()` helper, where structure upgrades or blockers are mandatory and template-only upgrades are recommended.

## Application Migration-Control Routes Hosted Here

This package also mounts the runtime application migration-control endpoints used by the current authoring flow:

- `GET /application/:applicationId/migrations/status`
- `GET /application/:applicationId/migrations`
- `GET /application/:applicationId/migration/:migrationId`
- `GET /application/:applicationId/migration/:migrationId/analyze`
- `POST /application/:applicationId/migration/:migrationId/rollback`

These routes read runtime application migration history, expose rollback analysis, and support guarded rollback execution.
They do not replace the runtime sync ownership of `@universo/applications-backend`.

## Ownership Boundary With Applications

`@universo/metahubs-backend` owns design-time metadata, branch runtime migrations, publication metadata, and the migration-control surface.
`@universo/applications-backend` owns runtime application schema sync, diff calculation, release-bundle export/apply, and persistence of `installed_release_metadata` in `applications.cat_applications`.
Publication-driven application creation crosses this boundary, but the final runtime sync route surface stays in `@universo/applications-backend`.

## Template Registry And Create Options

The built-in template registry still ships `basic` and `basic-demo`.
When creating a metahub, `createOptions` can still pre-seed the default hub, catalog, set, and enumeration entities, while branch creation and base layout creation remain mandatory.
Read this file as the package-local map of today’s hybrid state: a fixed design-time system app bootstrapped from a manual snapshot-equivalent baseline, plus runtime branch and application migration-control flows layered on top.
