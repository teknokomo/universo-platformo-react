# @universo/utils

Общий пакет утилит для валидации, сериализации, browser/runtime helper-ов и нейтральных database-access контрактов, используемых по всему репозиторию.

## Overview

Этот пакет предоставляет cross-environment helper-ы, которые backend и frontend пакеты могут использовать без прямой зависимости от framework-specific runtime кода.
Он также владеет executor и query helper контрактами, определяющими SQL-first стандарт репозитория.

## Database Standard Surface

- `@universo/utils/database` экспортирует `DbSession`, `DbExecutor` и `SqlQueryable`.
- Typed query helpers включают `queryMany`, `queryOne`, `queryOneOrThrow` и `executeCount`.
- Transaction и lock helpers включают `withTransaction`, `withAdvisoryLock` и timeout-safe SQL builders.
- Request-context helpers экспортируют `getRequestDbExecutor`, `getRequestDbSession` и создание нейтрального DB context.
- Вызывающий код использует эти контракты вместо импорта Knex или route-local query abstractions.

## Main Responsibilities

- Предоставлять helper-ы для валидации, парсинга, сериализации и browser/runtime support.
- Предоставлять нейтральный database-access contract, который потребляют domain packages.
- Сохранять typed query result normalization единообразной во всех backend packages.
- Централизовать логику helper-ов для lock-timeout и statement-timeout.
- Поддерживать небольшие переиспользуемые API, безопасные и для browser, и для server consumers.

## Compatibility Rules

- Сохраняйте публичные API обратно совместимыми и расширяемыми.
- Новые поля добавляйте как optional или defaulted при эволюции контрактов.
- Предпочитайте package-root или документированные subpath imports вместо случайных deep import-ов.
- Держите database helper-ы transport-neutral, чтобы domain packages не зависели от Knex.
- Сопровождайте новые helper-ы прямыми unit test-ами до того, как на них зависят другие пакеты.

## Operational Notes

- Browser-facing env helper-ы сохраняют документированный precedence order для host override-ов и Vite runtime config.
- Database timeout helper-ы являются утверждённым способом строить `SET LOCAL` statements для lock и long transaction flows.
- Result helper-ы намеренно нормализуют поведение к `T[]`, `T | null` и явным not-found ошибкам.
- Advisory-lock helper-ы валидируют границы timeout до генерации SQL.

## Development

```bash
pnpm --filter @universo/utils lint
pnpm --filter @universo/utils test
pnpm --filter @universo/utils build
```

## Related References

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [Стандарт доступа к базе данных](../../../docs/ru/architecture/database-access-standard.md)
- [Чеклист ревью кода базы данных](../../../docs/ru/contributing/database-code-review-checklist.md)
- [Индекс пакетов](../../README-RU.md)

## Related Packages

- `@universo/database` владеет жизненным циклом Knex runtime и фабриками executor-ов.
- `@universo/types` поставляет общие domain и enum contracts.
- Backend packages используют `@universo/utils/database` как нейтральный SQL-first seam.
- Frontend packages используют browser-safe env, validation и utility helper-ы.

## License

Omsk Open License
