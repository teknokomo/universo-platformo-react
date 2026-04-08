---
description: REST reference for metahub design-time scripts and application runtime script delivery.
---

# Scripts API

The scripts API spans metahub design-time authoring routes and application runtime delivery routes.
It keeps Common libraries, consumer scripts, client bundles, and server calls under one fail-closed contract.

## Metahub Design-Time Endpoints

- `GET /metahub/{metahubId}/scripts` lists design-time scripts for one attachment scope.
- `POST /metahub/{metahubId}/scripts` creates a design-time script.
- `GET /metahub/{metahubId}/script/{scriptId}`, `PATCH /metahub/{metahubId}/script/{scriptId}`, and `DELETE /metahub/{metahubId}/script/{scriptId}` read, update, or remove one script.
- Common authoring must pair `attachedToKind=general` with `moduleRole=library`.

## Application Runtime Endpoints

- `GET /applications/{applicationId}/runtime/scripts` lists published runtime script metadata without inline bundles.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` returns the cacheable client JavaScript bundle.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` executes only allowed non-lifecycle server methods.
- Runtime routes expose consumer scripts, not direct Common library rows.

## Fail-Closed Notes

- Unsupported imports, SDK versions, or scope-role combinations are rejected before runtime delivery.
- Shared library delete, rename, and circular dependency failures block publication and later runtime sync.
- Public runtime RPC requires `rpc.client` and cannot invoke lifecycle handlers.
- Application sync fails instead of silently skipping runtime script persistence.

## Related Reading

- [REST API](rest-api.md)
- [Shared Scripts](../platform/metahubs/shared-scripts.md)
- [Script Scopes](../platform/metahubs/script-scopes.md)