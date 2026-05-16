---
description: Геймификация и достижения LMS, смоделированные через Objects, Ledgers, workflows, scripts и reports.
---

# Геймификация LMS

![Object records, используемые настройками геймификации и достижениями LMS](../.gitbook/assets/entities/object-records.png)

Канонический LMS fixture моделирует геймификацию как конфигурацию и runtime data, а не как hardcoded LMS module.
Те же generic primitives можно переиспользовать в другом metahub, которому нужны points, badges или mechanics рейтинга.

## Модель метаданных

LMS template определяет следующие Objects:

- `GamificationSettings` хранит правила геймификации уровня application или workspace.
- `PointAwardRules` хранит детерминированные правила начисления баллов, например завершённые modules, принятые assignments и manual adjustments.
- `PointTransactions` хранит операционные изменения баллов и использует workflow actions для approval и reversal.
- `BadgeDefinitions` хранит метаданные бейджей и criteria выдачи.
- `BadgeIssues` хранит записи выдачи бейджей и использует workflow actions для issue и revoke flows.
- `LeaderboardSnapshots` хранит рассчитанные строки рейтинга, которые могут читать reports и dashboard widgets.

Template также определяет enumeration `PointSourceType` для course, track, assignment, training event, certificate и manual point sources.
Application constants, например `GamificationEnabled` и `DefaultPointAward`, держат app-level defaults в Sets, а не во frontend code.

## Workflow и posting

`PointTransactions` является transactional Object.
Workflow actions `ApprovePointAdjustment` и `ReversePointAdjustment` хранятся в Object metadata и разрешаются generic runtime workflow service.
Approved point transactions могут запускать `PointTransactionPostingScript`, который добавляет movement facts в `PointsLedger`.

`BadgeIssues` использует тот же metadata-driven pattern с actions `IssueBadge` и `RevokeBadge`.
Runtime permissions остаются fail-closed: action buttons появляются только когда resolved capability policy явно разрешает их, а backend workflow mutations остаются source of truth.

## Отчёты

Вывод геймификации доступен через saved report definitions:

- `Leaderboard` читает `LeaderboardSnapshots` и может агрегировать `TotalAwardedPoints`.
- `Achievements` читает `BadgeIssues`.

Существующие widgets `detailsTable`, CSV export и `report.aggregation` stat-card отображают эти reports.
Для текущего fixture не нужен LMS-specific leaderboard widget.

## Контракт fixture

Committed LMS snapshot генерируется Playwright и покрывается unit и E2E checks.
Контракт проверяет seeded settings, point rules, point transactions, badge definitions, badge issues, leaderboard rows, workflow metadata, reports и deterministic point totals.
