# @universo/rest-docs

Standalone Swagger UI and OpenAPI server for the current Universo Platformo REST surface.

## Overview

This package serves the generated OpenAPI specification at `/api-docs` and keeps the interactive REST reference decoupled from the main backend runtime.
Its source OpenAPI file is regenerated from the live backend route files before validation and build, so removed domains do not remain documented after repository refactors.

## What The Package Does

- Scans the mounted backend route files and regenerates `src/openapi/index.yml`.
- Bundles the generated OpenAPI source into `dist/openapi-bundled.yml` for runtime serving.
- Starts a small Express server that redirects `/` to `/api-docs`.
- Serves interactive Swagger UI for local validation, QA, and integration work.

## Current Route Coverage

The generated specification is organized around the route groups that currently exist in the repository:

- system health and ping
- auth
- public locales
- profile
- onboarding
- admin global users, instances, roles, locales, and settings
- applications, connectors, and runtime sync
- public metahub, metahubs, branches, publications, migrations, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, settings, and templates

The package intentionally documents the current route inventory first.
Payload schemas remain generic unless they are stabilized and promoted into explicit contract-level schemas later.

## Development Commands

```bash
pnpm --filter @universo/rest-docs generate:openapi
pnpm --filter @universo/rest-docs validate
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
pnpm --filter @universo/rest-docs lint
```

- `generate:openapi` rebuilds `src/openapi/index.yml` from the live route files.
- `validate` regenerates and lints the OpenAPI source with Redocly.
- `build` regenerates the source, compiles TypeScript, and bundles the runtime YAML.
- `start` serves Swagger UI from `dist/openapi-bundled.yml`.

## Running The Docs Server

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

By default, Swagger UI is exposed at `http://localhost:6655/api-docs`.
Use the local backend base URL `http://localhost:3000/api/v1` inside Swagger when you want to execute requests against a local stack.

## Safe Usage Notes

- Treat the generated document as the current path and method inventory, not as a fully typed payload contract.
- Prefer non-production environments when trying mutating endpoints from Swagger UI.
- Authenticated endpoints require a bearer token in the Swagger authorization dialog.
- If route mounts change, regenerate the OpenAPI source before reviewing or shipping docs changes.

## Related Documentation

- [Package architecture](ARCHITECTURE.md)
- [Endpoint guide](API_ENDPOINTS.md)
- [OpenAPI source entrypoint](src/openapi/index.yml)
- [Root project README](../../README.md)

---

Universo Platformo | REST docs server