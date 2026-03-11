# @universo/migrations-catalog

Каталожный пакет для истории применённых миграций и артефактов definition registry.

## Обязанности

-   Записывать применённые migration runs в платформенный каталог.
-   Предоставлять сервис platform migration catalog.
-   Поддерживать записи, ревизии, экспорты и импорты definition registry.
-   Выполнять bootstrap и mirror данных каталога при изменении платформенных definitions.

## Области публичного API

-   `PlatformMigrationCatalog` и `recordAppliedMigrationRun`.
-   `catalogBootstrapMigrations`.
-   `mirrorToGlobalCatalog`.
-   Definition-registry хелперы для list, register, export и import definitions.

## Разработка

```bash
pnpm --filter @universo/migrations-catalog build
pnpm --filter @universo/migrations-catalog test
```

## Связанные пакеты

-   `@universo/migrations-platform` использует этот пакет для сохранения migration и definition metadata.
-   `@universo/migrations-core` поставляет общие migration primitives, используемые здесь.