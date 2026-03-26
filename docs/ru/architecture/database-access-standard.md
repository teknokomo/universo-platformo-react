---
description: Объясняет converged PostgreSQL модель уровней, допустимые границы Knex и SQL-first правила ревью.
---

# Стандарт доступа к базе данных

Репозиторий использует единый аудируемый стандарт доступа к PostgreSQL во всех backend domain packages.
Knex остаётся общим transport и DDL engine, а повседневная доменная логика работает через нейтральные executor-контракты и SQL-first stores.

## Модель уровней

1. Tier 1 использует request-scoped `DbExecutor` с одним pinned connection и RLS claims.
2. Tier 2 использует pool-level `DbExecutor` для admin, bootstrap и public non-RLS сценариев.
3. Tier 3 оставляет raw Knex только в infrastructure, migrations и package-local DDL boundaries.

## Базовые правила

- Доменные route handlers и services принимают `DbExecutor` или `SqlQueryable`.
- Доменный код не импортирует `knex` или `KnexClient` напрямую.
- Динамические identifiers проходят через `qSchema`, `qTable`, `qSchemaTable` и `qColumn`.
- Мутирующий DML использует `RETURNING`, чтобы вызывающий код видел committed row shape.
- Active-row чтение обязано уважать soft-delete contract своего домена.
- Admin `SECURITY DEFINER` helper functions, принимающие `user_id`, могут использовать явный чужой user id только из Tier 2 backend/bootstrap-контекстов; request-scoped authenticated sessions должны оставаться self-scoped к `auth.uid()`.
- Zero-row writes fail closed, а не молча завершаются после stale lookup или race-condition.
- Advisory locks идут через shared helper-ы, а не через route-local или service-local raw helper forks.
- Долгие операции задают явные бюджеты `SET LOCAL lock_timeout` и `statement_timeout`.
- Schema-qualified names обязательны; доменный SQL не полагается на `search_path`.

## Допустимые Tier 3 Boundaries

- `@universo/schema-ddl` и migration packages владеют прямой Knex DDL orchestration.
- `@universo/database` владеет shared Knex lifecycle и фабриками executor-ов.
- `@universo/applications-backend` держит raw Knex за `src/ddl/index.ts` для DDL orchestration runtime sync.
- `@universo/metahubs-backend` держит raw Knex внутри своих DDL seams и путей интеграции schema-ddl.
- Эти boundaries могут мостить обратно в executor-style contracts, но route и store код вне их остаётся SQL-first.

## Поток запроса

1. `ensureAuthWithRls` pin-ит одно connection и применяет `request.jwt.claims`.
2. Route handlers выбирают request executor или pool executor на boundary-уровне.
3. Services и stores выполняют schema-qualified parameterized SQL через общие query и identifier helper-ы.
4. DDL- или migration-код остаётся в Tier 3 и может сохранять прямой доступ к Knex только внутри выделенных boundaries.

## Ожидания ревью

- Новые persistence helper-ы должны иметь прямые unit test-ы, а не только route-level mocks.
- Route handlers должны один раз выбрать корректный tier и передавать вниз нейтральные контракты.
- Потоки copy, delete, restore и sync должны явно доказывать своё fail-closed поведение.
- Package documentation и guidance в `AGENTS.md` должны использовать те же самые tier rules.

## Enforcement

- `tools/lint-db-access.mjs` блокирует запрещённое использование Knex в доменных пакетах.
- CI запускает шаг lint-db-access перед workspace build.
- Reviewers используют checklist для database code review из contributing docs.

## Связанные материалы

- [Проектирование базы данных](database.md)
- [Архитектура бэкенда](backend.md)
- [Чеклист ревью кода базы данных](../contributing/database-code-review-checklist.md)