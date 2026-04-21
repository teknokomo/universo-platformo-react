---
description: Каноническая модель сущностей LMS metahub template и guest-access runtime flows.
---

# Сущности LMS

LMS template намеренно сделан entity-first.
Все основные понятия LMS представлены как обычные metahub entities.

## Основные каталоги

| Сущность | Назначение |
| --- | --- |
| `Classes` | Учебные группы и потоки |
| `Students` | Зарегистрированные и гостевые учащиеся |
| `Modules` | Учебный контент и структурированные content items |
| `Quizzes` | Определения тестов с таблицами вопросов |
| `QuizResponses` | Сохранение ответов по каждому вопросу |
| `ModuleProgress` | Прогресс по модулям на каждого студента |
| `AccessLinks` | Записи для guest-access routing |
| `Enrollments` | Связь класс-студент-модуль |

## Вспомогательные enumeration

| Enumeration | Назначение |
| --- | --- |
| `ModuleStatus` | draft / published / archived |
| `EnrollmentStatus` | invited / active / completed / dropped |
| `QuestionType` | single choice / multiple choice |
| `ContentType` | text / image / video URL / quiz reference |

## Важные решения моделирования

- Варианты ответов теста хранятся в JSON-поле внутри каждой строки вопроса.
- `TABLE`-поля используются для content items модуля и вопросов теста.
- Access links остаются обычными runtime rows, а не отдельной routing subsystem.
- Guest sessions создают student rows в той же schema приложения, чтобы progress и статистику тестов можно было запрашивать совместно.

## Слой виджетов

LMS layout использует общие widgets:

- `moduleViewerWidget`
- `statsViewerWidget`
- `qrCodeWidget`

Платформенные пакеты предоставляют инфраструктуру рендера; LMS-специфический смысл задаётся конфигурацией metahub и runtime-данными.
