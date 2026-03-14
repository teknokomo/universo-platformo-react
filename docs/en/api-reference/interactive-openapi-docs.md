---
description: How to run and use the interactive OpenAPI and Swagger documentation.
---

# Interactive OpenAPI Docs

## Package

The interactive REST reference is served by `@universo/rest-docs`.

## Build And Start

Run the commands from the repository root:

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

The docs server is exposed by default at `http://localhost:6655/api-docs`.

## How To Use It

1. Start the main backend that exposes `/api/v1`.
2. Open the Swagger UI page from the docs server.
3. Set the server URL to the backend instance you want to inspect.
4. Add a bearer token in Swagger only when you need protected endpoints.
5. Prefer non-production environments for mutating requests.

## Important Notes

- The generated document is authoritative for current paths and methods.
- Payload schemas are still generic unless a route family has an explicit stable contract.
- If backend route mounts change, rebuild the docs package before relying on the UI.
