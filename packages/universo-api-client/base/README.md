# @universo/api-client

TypeScript API client package for Universo Platformo frontend integrations.

## Package Role

This package centralizes authenticated HTTP client creation for frontend code and
provides typed entry points for the currently exported API groups.

## Current Exported Surface

The package currently exports:

- `createUniversoApiClient` and the `UniversoApiClient` types.
- A default `api` instance created from the shared API base URL helper.
- `AttachmentsApi` plus `attachmentsQueryKeys`.
- `ConfigApi` plus `configQueryKeys`.
- `FeedbackApi` plus `feedbackQueryKeys`.
- `createValidationApi` plus validation response types.
- Shared query-key exports and package types.

## Important Maturity Note

The package surface is broader than the old canvases-only README suggested, but
not every exported API group is equally mature yet.

`validation.checkValidation(unikId, canvasId)` is the clearest concrete method
in the current codebase. `AttachmentsApi`, `ConfigApi`, and `FeedbackApi` are
already exported as typed integration points and query-key namespaces, but their
method-level implementation is still intentionally thin and expected to expand.

## Installation

```bash
pnpm add @universo/api-client
```

## Basic Usage

```typescript
import { createUniversoApiClient } from '@universo/api-client'

const api = createUniversoApiClient({ baseURL: '/api/v1' })

const result = await api.validation.checkValidation(unikId, canvasId)
console.log(result.data)
```

## Client Behavior

The internal HTTP client is created through `@universo/auth-frontend`, so it is
aligned with the repository's current session, CSRF, and 401 redirect behavior.

The returned client object also exposes `$client` for cases where you need the
underlying authenticated axios instance directly.

## Development

```bash
pnpm --filter @universo/api-client build
pnpm --filter @universo/api-client test
pnpm --filter @universo/api-client lint
```

## Related Documentation

- [Main package index](../../README.md)
- [Core Frontend](../../universo-core-frontend/base/README.md)
- [Auth Frontend](../../auth-frontend/base/README.md)
- [REST Docs](../../universo-rest-docs/README.md)

## License

Omsk Open License
