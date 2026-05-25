# @universo-react/migrations-core

Базовый runtime миграций для validation, identifiers, execution helpers и runtime storage.

## Обязанности

-   Предоставлять checksum и identifier хелперы для migration definitions.
-   Предоставлять validation, logging и typing утилиты для workflow миграций.
-   Выполнять migration plans через общий runner.
-   Хранить runtime-состояние миграций в переиспользуемом package-neutral слое.

## Области публичного API

-   Хелперы `checksum` и `identifiers`.
-   Утилиты `logger`, `types` и `validate`.
-   Execution helpers из `runner`.
-   State helpers из `runtimeStore`.

## Разработка

```bash
pnpm --filter @universo-react/migrations-core build
pnpm --filter @universo-react/migrations-core test
```

## Связанные пакеты

-   `@universo-react/migrations-platform` строит поверх этого runtime платформенную оркестрацию.
-   `@universo-react/migrations-catalog` переиспользует его примитивы definitions и execution.
