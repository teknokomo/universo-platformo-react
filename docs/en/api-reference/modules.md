---
description: REST reference for metahub design-time modules and application runtime module delivery.
---

# Modules API

The modules API spans metahub design-time authoring routes and application runtime delivery routes.
It keeps Resources workspace libraries, consumer modules, client bundles, and server calls under one fail-closed contract.

## Metahub Design-Time Endpoints

-   `GET /metahub/{metahubId}/modules` lists design-time modules for one attachment scope.
-   `POST /metahub/{metahubId}/modules` creates a design-time module.
-   `GET /metahub/{metahubId}/module/{moduleId}`, `PATCH /metahub/{metahubId}/module/{moduleId}`, and `DELETE /metahub/{metahubId}/module/{moduleId}` read, update, or remove one module.
-   Resources workspace authoring must pair `attachedToKind=general` with `moduleRole=library`.

Create/update payloads support:

-   `storageMode: "inline"` with `sourceCode`, the default database-backed mode.
-   `storageMode: "file"` with `sourcePath` and optional `sourceCode`; when `sourceCode` is present the backend writes it atomically to the configured source root, otherwise it reads the existing file.

`sourcePath` is a relative `modules/**/*.ts` or `modules/**/*.tsx` path. Absolute paths, parent traversal, hidden segments, symlink escapes, and JavaScript/ESM extensions are rejected.
Design-time list/read responses may include `sourceStorage` metadata. The manager-only Modules tab can show the effective source file path and checksum so authors can reconcile external-file edits; published runtime endpoints do not expose those authoring-only fields.

## Application Runtime Endpoints

-   `GET /applications/{applicationId}/runtime/modules` lists published runtime module metadata without inline bundles.
-   `GET /applications/{applicationId}/runtime/modules/{moduleId}/client` returns the cacheable client JavaScript bundle.
-   `POST /applications/{applicationId}/runtime/modules/{moduleId}/call` executes only allowed non-lifecycle server methods.
-   Runtime routes expose consumer modules, not direct Resources workspace library rows.

## Fail-Closed Notes

-   Unsupported imports, SDK versions, or scope-role combinations are rejected before runtime delivery.
-   Shared library delete, rename, and circular dependency failures block publication and later runtime sync.
-   Public runtime RPC requires `rpc.client` and cannot invoke lifecycle handlers.
-   Application sync fails instead of silently skipping runtime module persistence.
-   Existing metahub schemas without the file-source columns do not support file-backed commands; create a fresh schema or run a dedicated migration plan before enabling file storage there.

## Related Reading

-   [REST API](rest-api.md)
-   [Shared Modules](../platform/metahubs/shared-modules.md)
-   [Module Scopes](../platform/metahubs/module-scopes.md)
