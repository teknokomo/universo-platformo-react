---
description: Универсальная модель ресурсов LMS, используемая fixture метахаба и опубликованными приложениями.
---

# Модель ресурсов LMS

![Рабочее пространство ресурсов, используемое моделью ресурсов LMS](../.gitbook/assets/entities/resources-workspace.png)

LMS fixture моделирует учебный контент как обычные записи Object, а не как отдельный LMS runtime-тип.
Реализация Learning Content переводит продуктовую модель с временной content-first структуры на проекты, отдельные ресурсы, элементы курсов и стадии треков, создаваемые в рабочих пространствах.

## Сущности

-   `ContentProjects` группирует контент внутри рабочего пространства, не заменяя сами рабочие пространства приложения.
-   `LearningResources` хранит метаданные ресурсов: проект, тип, source descriptor, block body, estimated time, language, publication status и launch mode.
-   `Courses` хранит оболочку курса с проектом, навигацией, completion policy, status format, видимостью в каталоге, cover, instructor и tags.
-   `CourseSections` группирует содержимое курса.
-   `CourseItems` упорядочивает ссылки на resource, quiz, assignment или будущий training внутри разделов курса.
-   `LearningTracks`, `TrackStages` и `TrackSteps` задают learning paths на основе курсов.
-   `ContentStars`, `RecentContentViews`, `ContentAccessEntries` и `TrashEntries` поддерживают навигацию библиотеки и совместную работу.
-   Авторский контент остаётся в Page entities, например `CourseOverview`, `KnowledgeArticle` и `CertificatePolicy`.

## Контракт источника ресурса

Каждый ресурс использует ровно один locator источника:

-   `pageCodename` для авторских Page entities.
-   `url` для ссылок, видео, аудио и embedded content.
-   `storageKey` для будущих файлов в хранилище.
-   `packageDescriptor` или `storageKey` для будущих SCORM и xAPI пакетов.

LMS fixture намеренно не реализует загрузку файлов, извлечение пакетов, xAPI launch tracking и SCORM player.
SCORM, xAPI, storage-backed video/audio/document/file resources и предпросмотр office documents представлены как настроенные, но deferred resources.
Опубликованные приложения показывают локализованное deferred runtime state вместо имитации готового player/import pipeline.
Эти возможности должны добавляться через generic storage/runtime primitives, а не через LMS-specific frontend code.

## Runtime-поведение

Опубликованные приложения показывают ресурсы через существующие dashboard widgets, Page navigation, runtime rows и modules.
Единая библиотека контента использует универсальный datasource `records.union` поверх ресурсов, курсов и треков.
Корзина использует тот же datasource shape с `lifecycleState=deleted`.
Прогресс хранится в Object records и Object-backed ledgers, например `ProgressLedger` и `LearningActivityLedger`.

## Ссылка на пользовательское руководство

Для повседневной работы внутри опубликованного LMS-приложения используйте [Страницы и ссылки](../lms/resources-pages-links.md).
