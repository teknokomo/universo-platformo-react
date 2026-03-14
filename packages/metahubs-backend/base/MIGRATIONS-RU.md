# Metahubs Backend — Система миграций

> Актуальное локальное описание того, как сегодня работают фиксированное системное приложение `metahubs`, рантайм-схемы веток метахабов и связанные application migration-control routes. Общий обзор пакета см. в [README-RU.md](README-RU.md).

## Текущий принцип

`metahubs` является фиксированным system app для design-time metadata и одновременно пакетом, который пока всё ещё хостит текущую migration-control surface.
Долгосрочная цель состоит в том, чтобы большую часть этой модели напрямую authorить через сами metahubs, но этот flow пока не завершён.
Поэтому baseline сейчас поддерживается как вручную подготовленная snapshot-equivalent модель, превращается в system-app manifest и file-backed SQL migrations, а platform bootstrap материализует её при первом старте.

## Источники истины

| Источник | Роль |
| --- | --- |
| `src/platform/systemAppDefinition.ts` | Каноническая business-model fixed schema для system app `metahubs` |
| `src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts` | Канонический file-backed SQL artifact, который явно фиксирует parity contract для fixed schema |
| `prepareMetahubsSchemaSupportMigrationDefinition` | `pre_schema_generation` support SQL, который выполняется до fixed-schema generation |
| `finalizeMetahubsSchemaSupportMigrationDefinition` | `post_schema_generation` support SQL, который выполняется после fixed-schema generation |
| `seedBuiltinTemplatesMigration` | Post-schema platform migration, который сидирует встроенные metahub templates |

## Bootstrap при первом старте

При запуске платформы `@universo/core-backend` выполняет fixed system-app pipeline для `metahubs`:

1. Prelude migrations платформы запускают `pre_schema_generation` support SQL для схемы.
2. `ensureRegisteredSystemAppSchemaGenerationPlans()` строит fixed application-like entities из manifest и обеспечивает нужную форму схемы `metahubs`.
3. Post-schema migrations платформы запускают `post_schema_generation` support SQL и built-in template seed migration.
4. `bootstrapRegisteredSystemAppStructureMetadata()` синхронизирует метаданные `_app_objects` и `_app_attributes` для fixed schema.
5. В `metahubs._app_migrations` записывается детерминированная baseline-строка вроде `baseline_metahubs_structure_0_1_0`.

## Поверхность фиксированной схемы

Фиксированная схема `metahubs` хранит design-time metadata, данные реестра шаблонов и метаданные публикаций.
Среди business tables, определённых manifest, есть, например:

- `cat_metahubs`
- `cat_metahub_branches`
- `rel_metahub_users`
- `cat_templates`
- `doc_template_versions`
- `cat_publications`
- `doc_publication_versions`

Поверхность system tables для fixed schema следует из включённых application-like capabilities этого system app и отслеживается через локальные таблицы метаданных `_app_*`.

## Рантайм-миграции веток

Каждая ветка metahub по-прежнему владеет собственной управляемой runtime schema вида `mhb_<uuid32>_bN`.
Эти branch schemas версионируются отдельно от фиксированной схемы `metahubs` и используют metahub-specific таблицу истории `_mhb_migrations`.
Текущая числовая версия структуры веток равна `1`, а публичная semver-метка равна `0.1.0`.

Runtime migration engine для веток придерживается следующих правил:

- `calculateSystemTableDiff()` сравнивает сохранённую версию структуры ветки с текущим набором определений system tables.
- `SystemTableMigrator` применяет аддитивные DDL-изменения и записывает их в `_mhb_migrations`.
- Advisory locks PostgreSQL сериализуют apply-операции для одной и той же branch schema.
- Template seed migrations добавляют новые layouts, widgets, settings и связанные metadata без перезаписи пользовательских строк.

## Маршруты миграций метахабов

`@universo/metahubs-backend` владеет branch migration endpoints:

- `GET /metahub/:metahubId/migrations/status`
- `GET /metahub/:metahubId/migrations`
- `POST /metahub/:metahubId/migrations/plan`
- `POST /metahub/:metahubId/migrations/apply`

Эти маршруты вычисляют blockers, structure upgrades, template upgrades и apply plans для выбранной ветки.
Severity вычисляется через общий helper `determineSeverity()`, где structure upgrades или blockers обязательны, а template-only upgrades носят рекомендательный характер.

## Размещённые здесь application migration-control routes

Этот пакет также монтирует runtime application migration-control endpoints, используемые текущим authoring flow:

- `GET /application/:applicationId/migrations/status`
- `GET /application/:applicationId/migrations`
- `GET /application/:applicationId/migration/:migrationId`
- `GET /application/:applicationId/migration/:migrationId/analyze`
- `POST /application/:applicationId/migration/:migrationId/rollback`

Эти маршруты читают runtime application migration history, отдают rollback analysis и поддерживают guarded rollback execution.
Они не заменяют runtime sync ownership пакета `@universo/applications-backend`.

## Граница ответственности с applications

`@universo/metahubs-backend` владеет design-time metadata, branch runtime migrations, publication metadata и migration-control surface.
`@universo/applications-backend` владеет runtime application schema sync, diff calculation, release-bundle export/apply и сохранением `installed_release_metadata` в `applications.cat_applications`.
Publication-driven application creation пересекает эту границу, но финальная runtime sync route surface остаётся в `@universo/applications-backend`.

## Реестр шаблонов и create options

Встроенный template registry по-прежнему поставляет `basic` и `basic-demo`.
При создании metahub `createOptions` всё ещё могут предварительно сидировать сущности hub, catalog, set и enumeration по умолчанию, тогда как создание branch и базового layout остаётся обязательным.
Смотрите на этот файл как на локальную карту текущего гибридного состояния: fixed design-time system app, загружаемый из manual snapshot-equivalent baseline, и поверх него branch/runtime и application migration-control flows.
