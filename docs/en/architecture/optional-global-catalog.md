---
description: Optional global migration catalog modes and application release bundle workflow.
---

# Optional Global Catalog

This page describes the disabled-by-default global migration catalog model
and how application release bundles work when the registry is disabled.

## Modes

- Default mode keeps the global migration catalog disabled.
- Enabled mode turns on upl_migrations lifecycle, audit, and registry flows.
- Runtime schema correctness always stays anchored in local _app_migrations and _mhb_migrations tables.

## Flag

Use the shared flag below to switch modes:

```env
UPL_GLOBAL_MIGRATION_CATALOG_ENABLED=false
```

- false or unset: skip definition-registry bootstrap and mirror writes.
- true: require the catalog to be healthy and fail closed on registry or audit errors.

## Release Bundles

- Publications can now be exported as application_release_bundle artifacts from the application sync API.
- Bundle apply reuses applications.cat_applications.installed_release_metadata instead of introducing per-schema release state.
- Empty targets use the baseline/bootstrap path; existing targets use the incremental migration path with release-version checks.

## Operator Guidance

1. Leave the flag disabled for local development, fresh bootstrap, and installations that do not need registry observability.
2. Enable the flag only when operators need catalog-backed doctor, export/import lifecycle tracking, or audit history.
3. If bundle apply reports a release-version mismatch, export a bundle from the currently installed release or reconcile installed_release_metadata before retrying.

## Recovery Notes

- Disabled mode should never create the full upl_migrations definition registry on cold start.
- Enabled mode should be recovered by fixing the catalog health issue, not by silently downgrading to local-only writes.
- Application sync and bundle install state should always be checked first in applications.cat_applications.
