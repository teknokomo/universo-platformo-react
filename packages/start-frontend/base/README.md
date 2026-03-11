# @universo/start-frontend

Frontend package for onboarding UX, cookie flows, and start-page helpers.

## Responsibilities

-   Expose the `OnboardingWizard` and supporting start-page UI components.
-   Provide cookie-consent UI and related hooks.
-   Re-export onboarding API helpers, shared types, and views.
-   Keep onboarding frontend behavior isolated from the main application shell.

## Public API

-   `OnboardingWizard`, `SelectableListCard`, and cookie components.
-   `useCookieConsent` and `CookieConsentStatus`.
-   Re-exports from `views`, `api/onboarding`, and `types`.
-   Deprecated i18n registration helpers kept for compatibility.

## Development

```bash
pnpm --filter @universo/start-frontend build
```

## Related Packages

-   `@universo/core-frontend` can embed this package inside the shared application shell.
-   `@universo/start-backend` provides the backend flows consumed by this frontend module.