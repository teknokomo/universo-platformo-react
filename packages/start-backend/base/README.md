# @universo/start-backend

Backend package for onboarding and start-page service routes.

## Responsibilities

-   Expose start-service routes for onboarding-related backend flows.
-   Initialize and access the rate limiters used by those routes.
-   Keep onboarding backend logic isolated from the core server shell.
-   Provide a reusable feature package that can be mounted by the main backend runtime.

## Public API

-   `initializeRateLimiters`.
-   `getRateLimiters`.
-   `createStartServiceRoutes`.

## Development

```bash
pnpm --filter @universo/start-backend build
pnpm --filter @universo/start-backend test
```

## Related Packages

-   `@universo/core-backend` mounts this feature package into the main server.
-   `@universo/start-frontend` consumes the backend flows exposed here.