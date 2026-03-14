# Applications Backend — Система миграций

> Актуальное локальное описание того, как фиксированное системное приложение `applications` и управляемые рантайм-схемы приложений попадают в базу данных. Общий обзор пакета см. в [README-RU.md](README-RU.md).

## Текущий принцип

`applications` является фиксированным system app и одновременно отдельным application-like доменом внутри платформы.
Долгосрочная цель состоит в том, чтобы собирать тот же baseline через metahubs, но этот authoring flow пока не завершён.
Поэтому команда сейчас держит вручную подготовленный snapshot-equivalent baseline, кодирует его в system-app manifest и связанных SQL migration files, а platform bootstrap материализует его при первом старте.

## Источники истины

| Источник | Роль |
| --- | --- |
| `src/platform/systemAppDefinition.ts` | Каноническая business-model fixed schema для system app `applications` |
| `src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts` | Канонический file-backed SQL artifact, который явно фиксирует parity contract для fixed schema |
| `prepareApplicationsSchemaSupportMigrationDefinition` | `pre_schema_generation` support SQL, который выполняется до fixed-schema generation |
| `finalizeApplicationsSchemaSupportMigrationDefinition` | `post_schema_generation` support SQL, который выполняется после fixed-schema generation |

## Bootstrap при первом старте

При запуске платформы `@universo/core-backend` выполняет fixed system-app pipeline для `applications`:

1. Prelude migrations платформы запускают `pre_schema_generation` support SQL для схемы.
2. `ensureRegisteredSystemAppSchemaGenerationPlans()` строит fixed application-like entities из manifest и обеспечивает нужную форму схемы `applications`.
3. Post-schema migrations платформы запускают `post_schema_generation` support SQL для индексов, политик и других зависимых объектов.
4. `bootstrapRegisteredSystemAppStructureMetadata()` синхронизирует метаданные `_app_objects` и `_app_attributes` для fixed schema.
5. В `applications._app_migrations` записывается детерминированная baseline-строка вроде `baseline_applications_structure_0_1_0`.

## Поверхность фиксированной схемы

Фиксированная схема `applications` является платформенным каталогом метаданных приложений, а не runtime schema конкретного приложения.
Текущий manifest определяет следующие business tables:

- `cat_applications`
- `cat_connectors`
- `rel_connector_publications`
- `rel_application_users`

Текущая поверхность system tables для fixed schema следует из включённых application-like capabilities:

- `_app_migrations`
- `_app_settings`
- `_app_objects`
- `_app_attributes`

## Рантайм-схемы приложений

Каждое управляемое приложение по-прежнему получает собственную динамическую runtime schema вида `app_<uuid32>`.
Эти runtime schemas создаются или обновляются application sync engine, а не bootstrap-ом fixed schema `applications`.
Когда runtime schema существует, канонический общий набор system tables таков:

- `_app_migrations`
- `_app_settings`
- `_app_objects`
- `_app_attributes`
- `_app_values`
- `_app_layouts`
- `_app_widgets`

В текущем shared schema-ddl contract нет system table `_app_metadata`.

## Маршруты, которыми владеет этот пакет

`@universo/applications-backend` владеет runtime orchestration endpoints:

- `POST /application/:applicationId/sync`
- `GET /application/:applicationId/release-bundle`
- `POST /application/:applicationId/release-bundle/apply`
- `GET /application/:applicationId/diff`

Эти маршруты создают или обновляют управляемую runtime schema, сохраняют `schema_status`, `schema_snapshot` и `installed_release_metadata` в `applications.cat_applications`, а также используют один и тот же sync engine для publication-backed и file-bundle installs.

## Связанные migration-control маршруты

Migration guard и migration history endpoints для runtime applications сейчас монтируются в `@universo/metahubs-backend`, а не в этом пакете:

- `GET /application/:applicationId/migrations/status`
- `GET /application/:applicationId/migrations`
- `GET /application/:applicationId/migration/:migrationId`
- `GET /application/:applicationId/migration/:migrationId/analyze`
- `POST /application/:applicationId/migration/:migrationId/rollback`

Это разделение сделано намеренно: `@universo/applications-backend` владеет runtime sync и release-bundle execution, а `@universo/metahubs-backend` пока продолжает хостить migration-control surface, используемую текущим authoring flow.

## Как читать этот файл

Смотрите на этот файл как на локальное объяснение того, как system app `applications` сегодня попадает в базу данных.
Baseline начинается с вручную подготовленной snapshot-equivalent модели, platform bootstrap материализует fixed schema при первом старте, а затем runtime application schemas эволюционируют через sync, diff и release-bundle flows.
