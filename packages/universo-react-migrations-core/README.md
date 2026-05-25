# @universo-react/migrations-core

Core migration runtime for validation, identifiers, execution helpers, and runtime storage.

## Responsibilities

-   Provide checksum and identifier helpers for migration definitions.
-   Expose validation, logging, and typing utilities for migration workflows.
-   Run migration plans through the shared runner.
-   Store runtime migration state in a reusable, package-neutral layer.

## Public API Areas

-   `checksum` and `identifiers` helpers.
-   `logger`, `types`, and `validate` utilities.
-   `runner` execution helpers.
-   `runtimeStore` state helpers.

## Development

```bash
pnpm --filter @universo-react/migrations-core build
pnpm --filter @universo-react/migrations-core test
```

## Related Packages

-   `@universo-react/migrations-platform` builds on this runtime for platform-wide orchestration.
-   `@universo-react/migrations-catalog` reuses its definition and execution primitives.
