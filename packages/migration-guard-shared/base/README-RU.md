# @universo/migration-guard-shared

Общий frontend-ориентированный пакет для migration-status UX и переиспользуемых guard-хелперов.

## Обязанности

-   Предоставлять pure-хелперы для severity миграций и общие query options.
-   Предоставлять переиспользуемый React-компонент `MigrationGuardShell`.
-   Поддерживать единое поведение migration-guard UI в потоках metahub и application.
-   Предоставлять package-neutral surface, который могут переиспользовать разные frontend-модули.

## Публичный API

-   `determineSeverity` и его типы options.
-   `MIGRATION_STATUS_QUERY_OPTIONS`.
-   `MigrationGuardShell` и связанные типы props и context.

## Разработка

```bash
pnpm --filter @universo/migration-guard-shared build
```

## Связанные пакеты

-   Frontend-пакеты с migration-guard экранами переиспользуют этот пакет.
-   Пакет зависит от общих контрактов `@universo/types` и `@universo/utils`.