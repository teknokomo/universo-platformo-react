---
description: Универсальная модель ресурсов LMS, используемая fixture метахаба и опубликованными приложениями.
---

# Модель ресурсов LMS

LMS fixture моделирует учебный контент как обычные записи Catalog, а не как отдельный LMS runtime module.

## Сущности

- `LearningResources` хранит метаданные переиспользуемых ресурсов: тип, descriptor источника, оценочное время, язык и режим запуска.
- `Courses` группирует ресурсы и модули в продуктовый курс.
- `CourseSections` задаёт порядок ресурсов и модулей внутри курса.
- `LearningTracks` и `TrackSteps` описывают управляемые последовательности и prerequisites.
- Авторский контент остаётся в Page entities, например `CourseOverview`, `KnowledgeArticle` и `CertificatePolicy`.

## Контракт источника ресурса

Каждый ресурс использует ровно один locator источника:

- `pageCodename` для авторских Page entities.
- `url` для ссылок, видео, аудио и embedded content.
- `storageKey` для будущих файлов в хранилище.
- `packageDescriptor` или `storageKey` для будущих SCORM-like пакетов.

V1 fixture намеренно не реализует загрузку файлов, извлечение пакетов и SCORM player.
Эти возможности должны добавляться через generic storage/runtime primitives, а не через LMS-specific frontend code.

## Runtime-поведение

Опубликованные приложения показывают ресурсы через существующие dashboard widgets, Page navigation, runtime rows и scripts.
Прогресс хранится в Catalog records и Catalog-backed ledgers, например `ProgressLedger` и `LearningActivityLedger`.
