# @universo-react/modules-engine

Compiler and isolated runtime host for published Universo modules.

## Overview

-   Compiles TypeScript module sources into normalized server and client bundles.
-   Extracts method metadata from `AtServer`, `AtClient`, and `OnEvent` decorators.
-   Exposes pooled isolated-vm execution with health monitoring and lifecycle dispatch helpers.

The package also exports `compileScriptAssetEsm`. It bundles one PlayCanvas
script asset as browser ESM and returns the generated code, deterministic
SHA-256 checksum, and discovered `static scriptName` values. The compiler keeps
the bare `playcanvas` import external for the application import map, inlines
the supplied `@shared/<codename>` library sources in dependency order, and
rejects every other bare import before publication.

## Runtime Notes

-   Server execution uses `isolated-vm` with LRU isolate reuse.
-   Repeated failures open a per-bundle circuit breaker for a cooldown window.
-   `sdkApiVersion` support is currently pinned to `1.0.0`.
-   Embedded modules may import only from `@universo-react/extension-sdk`; unsupported static imports, `require()`, dynamic `import()`, and `import.meta` fail compilation.
-   Client bundles are intended for the dedicated runtime client-bundle endpoint.
-   PlayCanvas script-asset artifacts are main-thread ESM modules and are
    imported by the published canvas loader after checksum verification.
-   `OnEvent(...)` handlers are lifecycle-only and are never exposed on the public runtime RPC surface.
-   Browser execution must use a Worker-capable runtime on the application side.
-   The browser worker runtime disables ambient network, nested-worker, and dynamic-code globals before loading the client bundle.

## Development

`pnpm --filter @universo-react/modules-engine build`
`pnpm --filter @universo-react/modules-engine test`
`pnpm --filter @universo-react/modules-engine lint`

## License

Omsk Open License
