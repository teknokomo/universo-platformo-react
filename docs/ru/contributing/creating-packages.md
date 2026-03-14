---
description: Правила создания новых фронтенд- или бэкенд-модулей.
---

# Создание пакетов

## Общие правила

- Размещайте новые модули в `packages/` и следуйте действующим соглашениям об именовании.
- Используйте workspace package names для импортов через границы пакетов.
- Добавляйте синхронизированные README-файлы на английском и русском.
- Держите guidance в package `AGENTS.md` синхронизированным с теми же архитектурными правилами, если пакет владеет нетривиальным backend или infrastructure поведением.

## Фронтенд-пакеты

Новые фронтенд-пакеты должны использовать TypeScript или TSX и вписываться в
текущий build-паттерн для dual-format output, если они рассчитаны на переиспользование.

## Бэкенд-пакеты

Новые бэкенд-пакеты должны использовать SQL-first stores, доступ в стиле `DbExecutor`, platform migration definitions и root-level регистрацию там,
где она требуется.

### Правила работы с базой данных в backend packages

- Выбирайте access tier на route или orchestration boundary.
- Используйте Tier 1 request executor-ы для аутентифицированной работы с привязкой к RLS.
- Используйте Tier 2 `getPoolExecutor()` для admin, bootstrap и public non-RLS flows.
- Держите Tier 3 raw Knex только внутри infrastructure, migration или package-local DDL boundaries.
- Требуйте schema-qualified SQL, bind-параметры и identifier helper-ы для каждого динамического имени.
- Используйте `RETURNING` в mutating DML, когда важно подтверждение строки или fail-closed поведение.
- Добавляйте прямые tests для store или service SQL contracts вместо опоры только на route mocks.

Создание пакета — это архитектурная задача с последствиями для runtime и интеграций.
