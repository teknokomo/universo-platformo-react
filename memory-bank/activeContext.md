# Active Context

> **Last Updated**: 2026-01-27
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Three-Level System Fields Architecture (Completed)

**Status**: Implementation complete; build verified.

### Summary (2026-01-27)
- Implemented three-level prefixed system fields architecture (`_upl_*`, `_mhb_*`, `_app_*`) across all entities.
- Platform-level fields (`_upl_*`): `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `deleted`, `deleted_at`, `deleted_by`.
- Metahub-level fields (`_mhb_*`): `published`, `published_at`, `unpublished_at`, `archived`, `archived_at`.
- Application-level fields (`_app_*`): `published`, `published_at`, `unpublished_at`, `archived`, `archived_at`, `deleted`, `deleted_at`, `deleted_by`.
- Fixed `_upl_created_by`/`_upl_updated_by` propagation across all routes (catalogs, attributes, elements, publications, auto-created applications).
- Fixed `SchemaGenerator.syncSystemMetadata` to use new column names (`_upl_created_at`, `_upl_updated_at`).

### Next Step
- Drop old app schemas with incorrect structure and re-sync.
