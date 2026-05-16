---
description: Object-backed LMS report definitions and safe runtime execution.
---

# LMS Reports

![Object records used by LMS report definitions](../.gitbook/assets/entities/object-records.png)

LMS reports are configuration records in the existing `Reports` Object.
The platform does not add a report-only widget or LMS-specific report table for V1.

## Definition Shape

Each report record stores:

- localized name,
- report type,
- generic runtime datasource descriptor,
- columns,
- filters,
- aggregations,
- saved filter presets.

The current fixture includes `LearnerProgress`, `CourseProgress`, `Leaderboard`, and `Achievements` definitions.
They use `records.list` datasources so they can be rendered by existing `detailsTable`, chart, and overview-card widgets.
Gamification reports read ordinary Object rows such as `LeaderboardSnapshots` and `BadgeIssues`; score movement facts remain in `PointsLedger` and are surfaced through configured objects and reports instead of a hardcoded LMS dashboard.

## Safe Runner

The backend report runner validates the report definition with shared schemas from `@universo/types`.
Runtime API calls do not send a raw report definition.
They send exactly one saved report reference, either `reportId` or `reportCodename`, and the backend loads the JSON `Definition` from the published `Reports` Object in the current workspace.

The runner receives table and column identifiers only from resolved published metadata.
API payloads may reference saved report records, but they must not provide raw SQL identifiers or inline datasource definitions.

SQL values are parameterized, dynamic identifiers go through identifier helpers, unsupported fields fail closed, and JSON/TABLE fields are not exposed to filter/sort/report column SQL.
Registrar-only ledger Objects are excluded from report target discovery, so reports operate on ordinary runtime record Objects and not on internal fact ledgers.
Configured aggregations are executed by the same safe field map and are returned in the `aggregations` object using the report definition aliases.

## Runtime Usage

The existing `detailsTable` widget can render a saved report by `reportCodename` and request a CSV export for the same saved definition.
Overview stat cards can also use the generic `report.aggregation` metric datasource to display a configured aggregation alias.
Both paths reuse the saved report runner, current workspace scope, CSRF protection, and published metadata resolution.
