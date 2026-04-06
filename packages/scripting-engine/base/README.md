# @universo/scripting-engine

Compiler and isolated runtime host for published Universo scripts.

## Overview

- Compiles TypeScript script sources into normalized server and client bundles.
- Extracts method metadata from `AtServer`, `AtClient`, and `OnEvent` decorators.
- Exposes pooled isolated-vm execution with health monitoring and lifecycle dispatch helpers.

## Runtime Notes

- Server execution uses `isolated-vm` with LRU isolate reuse.
- Repeated failures open a per-bundle circuit breaker for a cooldown window.
- `sdkApiVersion` support is currently pinned to `1.0.0`.
- Embedded scripts may import only from `@universo/extension-sdk`; unsupported static imports, `require()`, dynamic `import()`, and `import.meta` fail compilation.
- Client bundles are intended for the dedicated runtime client-bundle endpoint.
- `OnEvent(...)` handlers are lifecycle-only and are never exposed on the public runtime RPC surface.
- Browser execution must use a Worker-capable runtime on the application side.
- The browser worker runtime disables ambient network, nested-worker, and dynamic-code globals before loading the client bundle.

## Development

`pnpm --filter @universo/scripting-engine build`
`pnpm --filter @universo/scripting-engine test`
`pnpm --filter @universo/scripting-engine lint`

## License

Omsk Open License