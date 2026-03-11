# @universo/start-frontend

Frontend-пакет для UX онбординга, cookie-потоков и хелперов стартовой страницы.

## Обязанности

-   Предоставлять `OnboardingWizard` и поддерживающие UI-компоненты стартовой страницы.
-   Предоставлять UI для cookie-consent и связанные hooks.
-   Реэкспортировать onboarding API-хелперы, общие типы и views.
-   Держать frontend-поведение онбординга изолированным от main application shell.

## Публичный API

-   `OnboardingWizard`, `SelectableListCard` и cookie-компоненты.
-   `useCookieConsent` и `CookieConsentStatus`.
-   Реэкспорты из `views`, `api/onboarding` и `types`.
-   Deprecated i18n registration helpers, сохранённые для совместимости.

## Разработка

```bash
pnpm --filter @universo/start-frontend build
```

## Связанные пакеты

-   `@universo/core-frontend` может встраивать этот пакет в общую application shell.
-   `@universo/start-backend` предоставляет backend-потоки, которые потребляет этот frontend-модуль.