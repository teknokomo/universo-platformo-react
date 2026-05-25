---
description: REST reference for metahub design-time modules and application runtime module delivery.
---

# Modules API

The modules API spans metahub design-time authoring routes and application runtime delivery routes.
It keeps Resources workspace libraries, consumer modules, client bundles, and server calls under one fail-closed contract.

## Metahub Design-Time Endpoints

- `GET /metahub/{metahubId}/modules` lists design-time modules for one attachment scope.
- `POST /metahub/{metahubId}/modules` creates a design-time module.
- `GET /metahub/{metahubId}/module/{moduleId}`, `PATCH /metahub/{metahubId}/module/{moduleId}`, and `DELETE /metahub/{metahubId}/module/{moduleId}` read, update, or remove one module.
- Resources workspace authoring must pair `attachedToKind=general` with `moduleRole=library`.

## Application Runtime Endpoints

- `GET /applications/{applicationId}/runtime/modules` lists published runtime module metadata without inline bundles.
- `GET /applications/{applicationId}/runtime/modules/{moduleId}/client` returns the cacheable client JavaScript bundle.
- `POST /applications/{applicationId}/runtime/modules/{moduleId}/call` executes only allowed non-lifecycle server methods.
- Runtime routes expose consumer modules, not direct Resources workspace library rows.

## Fail-Closed Notes

- Unsupported imports, SDK versions, or scope-role combinations are rejected before runtime delivery.
- Shared library delete, rename, and circular dependency failures block publication and later runtime sync.
- Public runtime RPC requires `rpc.client` and cannot invoke lifecycle handlers.
- Application sync fails instead of silently skipping runtime module persistence.

## Related Reading

- [REST API](rest-api.md)
- [Shared Modules](../platform/metahubs/shared-modules.md)
- [Module Scopes](../platform/metahubs/module-scopes.md)
