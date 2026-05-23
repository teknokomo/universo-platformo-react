---
description: Object-backed определения отчётов LMS и безопасное runtime-выполнение.
---

# Отчёты LMS

![Записи Object, используемые определениями отчётов LMS](../.gitbook/assets/entities/object-records.png)

Отчёты LMS являются конфигурационными записями в существующем Object `Reports`.
Для Learning Content платформа не добавляет отдельный report-only widget и не создаёт LMS-specific таблицу отчётов.

## Структура определения

Каждая запись отчёта хранит:

-   локализованное название,
-   тип отчёта,
-   generic runtime datasource descriptor,
-   колонки,
-   фильтры,
-   агрегации,
-   сохранённые наборы фильтров.

Текущий fixture содержит определения `LearningContentSummary`, `LearnerProgress`, `CourseProgress`, `Leaderboard` и `Achievements`.
Большинство из них используют datasources `records.list`, поэтому могут отображаться существующими `detailsTable`, chart и overview-card widgets.
`LearningContentSummary` использует `records.union` для ресурсов, курсов и треков; `records.union.projectedFields` проецирует обычные бизнес-компоненты, например `Instructor`, в тот же безопасный путь фильтрации и CSV export, что и настроенные колонки Learning Content.
Отчёты по геймификации читают обычные Object rows, например `LeaderboardSnapshots` и `BadgeIssues`; факты движения баллов остаются в `PointsLedger` и выводятся через настроенные objects и reports, а не через hardcoded LMS dashboard.

## Безопасный runner

Backend report runner валидирует определение отчёта shared-схемами из `@universo/types`.
Runtime API calls не передают raw report definition.
Они передают ровно одну ссылку на сохранённый отчёт: `reportId` или `reportCodename`, а backend загружает JSON `Definition` из опубликованного Object `Reports` в текущем workspace.

Имена таблиц и колонок runner получает только из разрешённых published metadata.
API payload может ссылаться на сохранённые записи отчётов, но не должен передавать raw SQL identifiers или inline datasource definitions.

SQL values параметризуются, dynamic identifiers проходят через identifier helpers, неизвестные поля fail closed, а JSON/TABLE поля не используются в SQL для фильтров, сортировки и колонок отчёта.
Registrar-only ledger Objects исключаются из поиска target для отчётов, поэтому отчёты работают с обычными runtime record Objects, а не с внутренними fact ledgers.
Настроенные aggregations выполняются через ту же безопасную карту полей и возвращаются в объекте `aggregations` с alias из definition отчёта.

## Runtime-использование

Существующий `detailsTable` widget может отображать сохранённый отчёт по `reportCodename` и запрашивать CSV export для того же сохранённого definition.
Overview stat cards также могут использовать generic datasource метрики `report.aggregation`, чтобы показывать настроенный aggregation alias.
Оба пути переиспользуют saved report runner, scope текущего workspace, CSRF protection и разрешение published metadata.

## Объём product QA

В текущем LMS fixture auditability отчётов считается поддержанной для выполнения сохранённых definitions:

-   report requests ссылаются только на сохранённые записи в опубликованном Object `Reports`;
-   backend tests покрывают проверку прав до доступа к metadata, безопасное выполнение `records.list` и `records.union`, CSV export и подавление runtime identifiers;
-   LMS runtime Playwright flow выполняет seeded reports `LearnerProgress`, `LearningContentSummary`, `CourseBuilderOutline` и `TrackBuilderOutline` в импортированном приложении.

UI для saved-filter management и scheduled report delivery остаются deferred product capabilities.
Они не требуются для текущего Learning Content fixture, потому что поддержанный путь — ручное выполнение и export опубликованных saved reports.
