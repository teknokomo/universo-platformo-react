---
description: Design-time to runtime architecture for the metahub modules system.
---

# Modules System

The modules system is split into design-time authoring, publication, and runtime execution layers.
Each layer normalizes the same shared manifest contract so role, source kind, and capabilities stay consistent.

## Flow

1. Metahub authoring stores attachment scope, module role, source kind, declared capabilities, Common/library attachment metadata, and a physical source storage contract.
2. The modules engine validates pure shared libraries, resolves `@shared/<codename>` imports, compiles the source into server and client bundles, and emits a normalized manifest.
3. Publication sync copies active consumer modules into application runtime tables with scoped codename uniqueness while keeping shared-library logic available through compiled consumers.
4. Runtime list endpoints expose metadata only, while the client bundle is fetched through a separate ETag-aware endpoint.
5. Server execution uses isolated-vm with pooled isolates, health monitoring, and a capability-gated context bridge.

## Source Storage Boundary

`sourceKind` describes the semantic authoring/runtime kind and remains `embedded` in this slice.
Physical storage is separate:

-   `inline`: source text is stored in `_mhb_modules.source_code`.
-   `file`: `_mhb_modules.source_code` is `NULL`; the backend reads the source from `UPL_MODULE_SOURCE_ROOT`.

Persisted file paths are relative to the metahub branch source root and always start with `modules/`.
They never include metahub ids, branch ids, schema ids, attached entity ids, or absolute host paths.
The filesystem boundary validates path traversal, hidden segments, extension allowlists, byte size, symlink containment, atomic writes, checksums, and branch-root isolation.

Published applications remain bundle-only. The applications backend receives compiled server/client bundles and must not read design-time source files from disk.

## Safety Boundaries

-   Embedded source kind is the only supported authoring kind in v1; physical storage may be inline or file-backed.
-   Embedded modules may import from `@universo-react/extension-sdk`, and consumer modules may additionally import Resources workspace libraries through `@shared/<codename>`; other static imports, `require()`, dynamic `import()`, and `import.meta` fail compilation.
-   Runtime package imports such as `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`, and `@universo-react/colyseus-server` must be attached to the metahub/application and declared as allowed package imports for the active runtime target. The compiler does not allow arbitrary package imports.
-   The `general` attachment scope is reserved for `library`, and new `library` authoring is rejected outside the Resources workspace before bundles are stored.
-   Shared libraries must stay pure: decorators, runtime ctx access, and executable runtime entrypoints are rejected during validation.
-   Dependency-sensitive shared-library deletes, codename changes, and circular `@shared/*` graphs fail closed before publication sync can produce runtime state.
-   Capabilities are deny-by-default and unavailable APIs throw explicit runtime errors.
-   Client execution requires a Worker-capable browser runtime instead of falling back to the main thread.
-   The browser worker runtime disables ambient network, nested-worker, and dynamic-code globals before the client bundle is loaded.
-   Lifecycle dispatch skips modules that do not declare the lifecycle capability.

## Related Surfaces

-   `@universo-react/extension-sdk` defines the author-facing base class and decorators.
-   `@universo-react/modules-engine` owns compilation, bundle splitting, isolate pooling, and health monitoring.
-   Applications runtime routes expose list, client bundle, and server call endpoints for published modules.
