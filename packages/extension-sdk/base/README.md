# @universo/extension-sdk

Source-only scripting authoring primitives for Universo runtime modules.

## Overview

- Consumed directly from `src/index.ts`; no `dist/` output is published.
- The stable root barrel now re-exports a modular SDK split across `types`, `decorators`, `ExtensionScript`, `registry`, `widget`, and `apis/*`.
- Exports `ExtensionScript`, `AtServer`, `AtClient`, `AtServerAndClient`, and `OnEvent`.
- Defines the shared runtime context contract for records, metadata, server RPC bridging, and reserved `http`/`state`/`log`/`i18n` seams.

## Authoring Rules

- Scripts export a class that extends `ExtensionScript`.
- `AtClient()` marks browser methods compiled into the client bundle.
- `AtServer()` marks server methods that stay in the server bundle.
- `AtServerAndClient()` keeps a method available in both server and client bundles.
- `OnEvent(...)` marks server lifecycle handlers and cannot be combined with client-exposed targets.
- `sdkApiVersion` is currently limited to `1.0.0`.
- Only non-lifecycle server or shared methods from scripts that declare `rpc.client` are bridged through `this.ctx.callServerMethod(...)`.
- Embedded scripts may import only from `@universo/extension-sdk`; external or relative imports, `require()`, dynamic `import()`, and `import.meta` are not part of the supported authoring contract.
- Keep decorator syntax inside script authoring sources; ordinary frontend bundles do not enable decorators.

## Development

`pnpm --filter @universo/extension-sdk build`
`pnpm --filter @universo/extension-sdk lint`

## License

Omsk Open License