# @universo/migrations-platform

Пакет платформенного реестра миграций и CLI-ориентированной оркестрации.

## Обязанности

-   Регистрировать platform migration definitions.
-   Планировать, запускать, diff, export и validate зарегистрированные platform migrations.
-   Адаптировать SQL definitions в платформенный migration runtime.
-   Предоставлять CLI entry points, используемые корневыми migration-командами.

## Области публичного API

-   `createPlatformMigrationFromSqlDefinition`.
-   Экспорт реестра `platformMigrations`.
-   Хелперы planning, execution, diff, export и validation.
-   CLI-интеграция через build output пакета.

## Разработка

```bash
pnpm --filter @universo/migrations-platform build
pnpm --filter @universo/migrations-platform test
```

## Связанные пакеты

-   Корневые workspace-скрипты вроде `pnpm migration:status` и `pnpm migration:plan` опираются на этот пакет.
-   Пакет координирует backend migration definitions вместе с catalog и core migration runtime.