---
description: Design-time to runtime architecture for the metahub scripting system.
---

# Scripting System

The scripting system is split into design-time authoring, publication, and runtime execution layers.
Each layer normalizes the same shared manifest contract so role, source kind, and capabilities stay consistent.

## Flow

1. Metahub authoring stores source code, attachment scope, module role, source kind, declared capabilities, and Common/library attachment metadata.
2. The scripting engine validates pure shared libraries, resolves `@shared/<codename>` imports, compiles the source into server and client bundles, and emits a normalized manifest.
3. Publication sync copies active consumer scripts into application runtime tables with scoped codename uniqueness while keeping shared-library logic available through compiled consumers.
4. Runtime list endpoints expose metadata only, while the client bundle is fetched through a separate ETag-aware endpoint.
5. Server execution uses isolated-vm with pooled isolates, health monitoring, and a capability-gated context bridge.

## Safety Boundaries

- Embedded authoring is the only supported source mode in v1.
- Embedded scripts may import from `@universo/extension-sdk`, and consumer scripts may additionally import Resources workspace libraries through `@shared/<codename>`; other static imports, `require()`, dynamic `import()`, and `import.meta` fail compilation.
- The `general` attachment scope is reserved for `library`, and new `library` authoring is rejected outside the Resources workspace before bundles are stored.
- Shared libraries must stay pure: decorators, runtime ctx access, and executable runtime entrypoints are rejected during validation.
- Dependency-sensitive shared-library deletes, codename changes, and circular `@shared/*` graphs fail closed before publication sync can produce runtime state.
- Capabilities are deny-by-default and unavailable APIs throw explicit runtime errors.
- Client execution requires a Worker-capable browser runtime instead of falling back to the main thread.
- The browser worker runtime disables ambient network, nested-worker, and dynamic-code globals before the client bundle is loaded.
- Lifecycle dispatch skips scripts that do not declare the lifecycle capability.

## Related Surfaces

- `@universo/extension-sdk` defines the author-facing base class and decorators.
- `@universo/scripting-engine` owns compilation, bundle splitting, isolate pooling, and health monitoring.
- Applications runtime routes expose list, client bundle, and server call endpoints for published scripts.
