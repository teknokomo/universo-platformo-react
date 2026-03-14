# Universo Platformo REST Docs Architecture

> Last Updated: 2026-03-14
> Scope: current-state OpenAPI generation and Swagger serving

## Overview

`@universo/rest-docs` is a documentation-only package.
Its responsibility is to publish a current OpenAPI path inventory for the mounted `/api/v1` surface and serve that inventory through Swagger UI without coupling the main backend runtime to documentation tooling.

## Core Architecture

The package is intentionally split into three stages:

1. Source generation
  - `scripts/generate-openapi-source.js` scans the live route files in the backend packages and rebuilds `src/openapi/index.yml`.
2. Runtime bundling
  - `scripts/bundle-openapi.js` bundles the generated YAML into `dist/openapi-bundled.yml`.
3. Documentation serving
  - `src/index.ts` loads the bundled YAML and exposes Swagger UI at `/api-docs`.

This flow makes the route inventory reproducible from repository code instead of relying on a manually curated historical taxonomy.

## Source Of Truth Boundary

The source of truth for route existence is the backend route layer, not the docs package.
`@universo/rest-docs` derives its OpenAPI inventory from route declarations in packages such as auth, profile, start, admin, applications, and metahubs.

That boundary matters because the repository has already removed historical domains.
Keeping a hand-maintained mirror inside the docs package would let deleted domains remain visible long after they stopped existing in the runtime.

## What Is Generated

The generated OpenAPI file currently guarantees:

- the current path inventory
- the current HTTP method inventory per path
- path parameter extraction from Express-style `:param` segments
- public versus bearer-protected route distinction where the repository surface makes that clear
- generic request and response envelopes suitable for interactive exploration and QA

The generated file does not yet attempt to infer detailed request-body or response-body schemas from handlers.
That deeper schema modeling can be added later only if it is sourced from stable contracts instead of best-effort guesswork.

## Current Domain Groups

The generated inventory covers these mounted route families:

- system health and ping
- auth
- public locales
- profile
- onboarding
- admin domains
- applications, connectors, and application runtime sync
- public metahub and metahub design-time domains

This list is intentionally aligned with the current backend package structure rather than with removed workspace-era terminology.

## Operational Guidance

- Run `pnpm --filter @universo/rest-docs generate:openapi` whenever route mounts change.
- Run `pnpm --filter @universo/rest-docs validate` before shipping docs changes.
- Run `pnpm --filter @universo/rest-docs build` before starting the standalone Swagger server.
- Treat Swagger as an operator and QA aid, not as proof that all payload schemas are stable.

## Extension Rules

When new route packages are added to the mounted backend surface:

1. Add the route file to `routeSources` in `scripts/generate-openapi-source.js`.
2. Assign the correct mount prefix, tag, and security mode.
3. Regenerate the OpenAPI source.
4. Update package and GitBook documentation if the new route family changes user-facing guidance.

When a route family is removed, delete it from the generator immediately so the docs surface stays fail-closed.
