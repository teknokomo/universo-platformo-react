---
description: Base REST API conventions for Universo Platformo React.
---

# REST API

## Base URL

```text
https://your-instance.example.com/api/v1
```

## Current API Shape

The current repository organizes API routes by platform module rather than by
the removed legacy workspace taxonomy.

Typical route groups include system health, auth, locales, profile, onboarding,
applications, connectors, admin, public metahub, and metahub design-time APIs.

## Interactive Documentation Source

The interactive Swagger and OpenAPI presentation layer is provided by
`@universo/rest-docs`.

That package regenerates its `src/openapi/index.yml` file from the live backend
route files before validation and build so the published route inventory stays
aligned with the repository after refactors.

For the run-and-use workflow, continue to the Interactive OpenAPI Docs page in
this section.

## Metahub Shared Authoring Endpoints

- `GET /metahub/{metahubId}/shared-containers` resolves the virtual Common containers used for shared attributes, constants, and values.
- `GET /metahub/{metahubId}/shared-entity-overrides` lists sparse exclusion or ordering overrides for one shared entity or one target object.
- `PATCH /metahub/{metahubId}/shared-entity-overrides` upserts fail-closed exclusion, active-state, or sort-order overrides for shared entities.
- `GET /metahub/{metahubId}/scripts` plus `POST /metahub/{metahubId}/scripts` list and create design-time scripts; Common authoring must pair `attachedToKind=general` with `moduleRole=library`.
- `GET /metahub/{metahubId}/script/{scriptId}`, `PATCH /metahub/{metahubId}/script/{scriptId}`, and `DELETE /metahub/{metahubId}/script/{scriptId}` fail closed when a shared-library rename, delete, or circular dependency would break `@shared/<codename>` consumers.
- `GET /metahub/{metahubId}/export` and `POST /metahubs/import` preserve the shared snapshot sections together with layouts, scripts, and publication-ready metadata.

## Runtime Script Endpoints

- `GET /applications/{applicationId}/runtime/scripts` lists published client-visible runtime scripts without embedding bundle bodies.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` returns the JavaScript client bundle with `ETag` and `304 Not Modified` support.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` executes only non-lifecycle published server methods from scripts that declare `rpc.client`, and preserves fail-closed capability/error codes.

Use these endpoints together when a runtime surface needs script metadata, bundle delivery, and RPC execution.
