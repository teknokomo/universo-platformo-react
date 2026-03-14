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

## Управление схемами системных приложений

Пакет включает `systemAppSchemaCompiler`, который управляет генерацией
схем для всех четырёх фиксированных системных приложений (admin, profiles,
metahubs, applications). Каждое приложение предоставляет манифест
`SystemAppDefinition`; компилятор преобразует `targetBusinessTables` в
`EntityDefinition[]` через `buildSystemAppBusinessEntities()`, сравнивает
с последним записанным снимком и применяет только необходимые DDL.

Ключевые функции:

-   `upgradeSystemAppSchemaGenerationPlan()` — инкрементальный diff + apply.
-   `ensureSystemAppSchemaGenerationPlan()` — точка входа при запуске; пропускает, если схема актуальна.
-   `applySystemAppSchemaGenerationPlan()` — полная перегенерация (используется CLI).

См. [Жизненный цикл миграций системных приложений](../../../docs/ru/architecture/system-app-migration-lifecycle.md)
для полного описания архитектуры.

## CLI-команды

Следующие CLI-команды доступны через корневые workspace-скрипты:

| Команда                          | Описание                                          |
|----------------------------------|---------------------------------------------------|
| `system-app-schema-plan`         | Показать ожидающие изменения схемы без применения  |
| `system-app-schema-apply`        | Применить полную (пере)генерацию схем приложений   |
| `system-app-schema-bootstrap`    | Сбросить и загрузить схемы приложений с нуля       |
| `doctor`                         | Проверить состояние миграций и целостность метаданных|

## Разработка

```bash
pnpm --filter @universo/migrations-platform build
pnpm --filter @universo/migrations-platform test
```

## Связанные пакеты

-   Корневые workspace-скрипты вроде `pnpm migration:status` и `pnpm migration:plan` опираются на этот пакет.
-   Пакет координирует backend migration definitions вместе с catalog и core migration runtime.