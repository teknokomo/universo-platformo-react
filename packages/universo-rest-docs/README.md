# @universo/rest-docs

Standalone Swagger UI and OpenAPI server for the current Universo Platformo REST documentation surface.

## Overview

This package serves the bundled OpenAPI specification at `/api-docs` and provides a dedicated documentation process separate from the main backend runtime.
It documents the route groups that currently exist in the package specification, including historical API groups that are still present in the transitional OpenAPI layer.

## What The Package Does

- Loads the bundled OpenAPI document generated from `src/openapi/index.yml`.
- Starts a small Express server that redirects `/` to `/api-docs`.
- Serves interactive Swagger UI for local and remote API exploration.
- Keeps the authoring source modular under `src/openapi/` and bundles it for runtime use.

## Current Specification Scope

The current OpenAPI tree still includes the route groups defined in `src/openapi/index.yml`:

- authentication
- uniks
- spaces
- canvases
- metaverses
- publications
- profile
- space-builder

This README intentionally describes the package as it exists today.
If the platform taxonomy changes, the OpenAPI source should be updated first and this README should then follow that source.

## Development Notes

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs validate
pnpm --filter @universo/rest-docs lint
```

- `build` compiles TypeScript and bundles the modular OpenAPI files.
- `validate` lints `src/openapi/index.yml` with Redocly.
- Runtime serving uses `dist/openapi-bundled.yml`, not the authoring tree directly.

## Running The Docs Server

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

By default, Swagger UI is exposed at `http://localhost:6655/api-docs`.

## Related Documentation

- [Main package index](../README.md)
- [Root project README](../../README.md)
- [OpenAPI authoring entrypoint](src/openapi/index.yml)
- [Architecture notes](ARCHITECTURE.md)

---

Universo Platformo | REST docs server