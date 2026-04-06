---
description: Design-time to runtime architecture for the metahub scripting system.
---

# Scripting System

The scripting system is split into design-time authoring, publication, and runtime execution layers.
Each layer normalizes the same shared manifest contract so role, source kind, and capabilities stay consistent.

## Flow

1. Metahub authoring stores source code, attachment scope, module role, source kind, and declared capabilities.
2. The scripting engine compiles the source into server and client bundles and emits a normalized manifest.
3. Publication sync copies active scripts into application runtime tables with scoped codename uniqueness.
4. Runtime list endpoints expose metadata only, while the client bundle is fetched through a separate ETag-aware endpoint.
5. Server execution uses isolated-vm with pooled isolates, health monitoring, and a capability-gated context bridge.

## Safety Boundaries

- Embedded authoring is the only supported source mode in v1.
- Embedded scripts may import only from `@universo/extension-sdk`; unsupported static imports, `require()`, dynamic `import()`, and `import.meta` fail compilation.
- Capabilities are deny-by-default and unavailable APIs throw explicit runtime errors.
- Client execution requires a Worker-capable browser runtime instead of falling back to the main thread.
- The browser worker runtime disables ambient network, nested-worker, and dynamic-code globals before the client bundle is loaded.
- Lifecycle dispatch skips scripts that do not declare the lifecycle capability.

## Related Surfaces

- `@universo/extension-sdk` defines the author-facing base class and decorators.
- `@universo/scripting-engine` owns compilation, bundle splitting, isolate pooling, and health monitoring.
- Applications runtime routes expose list, client bundle, and server call endpoints for published scripts.