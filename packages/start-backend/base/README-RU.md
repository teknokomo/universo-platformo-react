# @universo/start-backend

Backend-пакет для сервисных маршрутов онбординга и стартовой страницы.

## Обязанности

-   Предоставлять start-service routes для backend-потоков, связанных с онбордингом.
-   Инициализировать и предоставлять rate limiters, используемые этими маршрутами.
-   Держать backend-логику онбординга изолированной от core server shell.
-   Предоставлять переиспользуемый feature-пакет, который может монтироваться главным backend runtime.

## Публичный API

-   `initializeRateLimiters`.
-   `getRateLimiters`.
-   `createStartServiceRoutes`.

## Разработка

```bash
pnpm --filter @universo/start-backend build
pnpm --filter @universo/start-backend test
```

## Связанные пакеты

-   `@universo/core-backend` монтирует этот feature-пакет в основной сервер.
-   `@universo/start-frontend` использует backend-потоки, которые здесь публикуются.