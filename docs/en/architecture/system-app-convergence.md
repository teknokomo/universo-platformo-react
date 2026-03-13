---
description: Fixed system-app convergence model for application-like schemas.
---

# Fixed System-App Convergence

This page documents the converged model for the fixed system applications in the platform.

## Scope

The fixed system applications are:
- `admin`
- `profiles`
- `metahubs`
- `applications`

All four schemas now bootstrap as application-like fixed schemas.

## Structural Rules

- Business tables use the canonical prefixes `cat_`, `doc_`, `rel_`, and `cfg_`.
- Fixed system-app business rows use the dual lifecycle layers `_upl_*` and `_app_*`.
- Branch schemas keep `_mhb_*` fields and are not part of this convergence rule.
- Dynamic application schemas keep `_app_*` fields and follow the same naming contract.

## Bootstrap Flow

1. Run pre-schema platform migrations that prepare shared database capabilities.
2. Generate fixed system-app schemas from registered manifest-driven schema plans.
3. Run post-schema platform migrations that depend on generated fixed tables.
4. Bootstrap `_app_objects` and `_app_attributes` metadata for the fixed schemas.
5. Skip repeated metadata sync only when the live fingerprint matches the compiled target.

## Ownership Boundaries

- `@universo/migrations-platform` owns manifest loading, schema plan compilation, and fixed-schema bootstrap orchestration.
- `@universo/metahubs-backend` owns publication runtime sources and publication authoring logic.
- `@universo/applications-backend` owns application runtime sync and diff routes.
- `@universo/core-backend` composes the publication source seam with the application-owned sync routes.

## Acceptance Contract

- Fresh bootstrap must create canonical fixed schemas without rename-style reconciliation in the active manifest path.
- Publication-created application bootstrap must continue to route through the publication runtime source seam into application-owned sync.
- Manifest validation rules must not allow values longer than the backing PostgreSQL columns.
- Cross-package regression coverage must exist for both fixed bootstrap shape and the publication-to-application sync path.