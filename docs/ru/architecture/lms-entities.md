---
description: Каноническая модель сущностей LMS-шаблона метахаба и рантайм-потоков гостевого доступа.
---

# Сущности LMS

LMS-шаблон намеренно построен вокруг сущностей.
Все основные понятия LMS представлены как обычные сущности метахаба.

## Основные каталоги

| Сущность         | Назначение                                                                             |
| ---------------- | -------------------------------------------------------------------------------------- |
| `LearnerHome`    | Нефизическая Page с Editor.js-совместимыми блоками для стартовой поверхности учащегося |
| `Classes`        | Учебные группы и потоки                                                                |
| `Students`       | Зарегистрированные и гостевые учащиеся                                                 |
| `Modules`        | Учебный контент и структурированные элементы содержимого                               |
| `Quizzes`        | Определения тестов с таблицами вопросов                                                |
| `QuizResponses`  | Сохранение ответов по каждому вопросу                                                  |
| `ModuleProgress` | Прогресс по модулям на каждого студента                                                |
| `AccessLinks`    | Записи для маршрутизации гостевого доступа                                             |
| `Enrollments`    | Связь класс-студент-модуль                                                             |

## Операционные регистры

| Регистр          | Назначение                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `ProgressLedger` | Append-oriented движения учебного прогресса по учащемуся, модулю, workspace и попытке             |
| `ScoreLedger`    | Append-oriented движения результатов тестов и оценок с измерениями score, max score и percent     |

## Вспомогательные enumeration

| Enumeration        | Назначение                                |
| ------------------ | ----------------------------------------- |
| `ModuleStatus`     | draft / published / archived              |
| `EnrollmentStatus` | invited / active / completed / dropped    |
| `QuestionType`     | single choice / multiple choice           |
| `ContentType`      | text / image / video URL / quiz reference |

## Важные решения моделирования

-   Варианты ответов теста хранятся в JSON-поле внутри каждой строки вопроса.
-   `TABLE`-поля используются для content items модуля и вопросов теста.
-   `LearnerHome` является Page, а не физической runtime-таблицей. Её содержимое хранится в metadata blocks и рендерится общей dashboard details surface.
-   `ProgressLedger` и `ScoreLedger` являются стандартными Ledger entities, а не LMS-specific services. Они используют общий блок Ledger configuration для dimensions, resources, measures, period fields и projections.
-   Транзакционные LMS-каталоги используют общую вкладку Catalog `behavior` для нумерации, effective dates, lifecycle states, posting targets и posting scripts. LMS fixture хранит эти настройки в `config.recordBehavior`.
-   Access links остаются обычными runtime rows, а не отдельной routing subsystem.
-   Guest sessions создают student rows в той же schema приложения, чтобы progress и статистику тестов можно было запрашивать совместно.

## Редактирование контента Page

Контент Page редактируется в метахабе на маршруте контента, принадлежащем сущности:
`/metahub/:metahubId/entities/:kindKey/instance/:entityId/content`.

Поверхность редактирования использует официальный Editor.js core и инструменты через общий adapter `@universo/template-mui`.
Backend не сохраняет raw Editor.js `OutputData`; перед сохранением поддерживаемые блоки нормализуются в каноническую Page block schema, а небезопасный текст, неподдерживаемые блоки и небезопасные URL отклоняются.
Опубликованные приложения не подключают Editor.js для рендеринга.
`packages/apps-template-mui` рендерит канонические Page blocks через существующие runtime dashboard components.

## Слой виджетов

LMS layout использует те же общие dashboard-виджеты, что и другие опубликованные приложения:

-   `menuWidget` с выбранными основными пунктами, optional overflow и `startPage`, указывающим на `LearnerHome`.
-   `appNavbar`, `header`, `detailsTitle` и `detailsTable` для runtime shell и поверхностей данных.
-   `columnsContainer`, когда макету нужна составная dashboard-композиция с сохранением конфигурации вложенных виджетов.

Платформа по-прежнему поддерживает script-backed widgets и QR widgets как общие возможности, но LMS fixture не привязывает глобальные module/statistics/QR widgets в default application layout.
LMS-специфическое поведение задаётся конфигурацией metahub, данными сущностей, скриптами на релевантной metadata surface и публичными runtime-ссылками.
