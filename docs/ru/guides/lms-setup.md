---
description: Пошаговая настройка канонического LMS-метахаба, публикации, связанного приложения и snapshot fixture.
---

# Настройка LMS

Это руководство описывает поддерживаемый workflow для встроенного LMS-шаблона и его канонического fixture Learning Portal.

## 1. Создайте или пересоберите канонический fixture

1. Используйте generator spec `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
2. Считайте `tools/testing/e2e/support/lmsFixtureContract.ts` источником истины для seeded dataset.
3. Перегенерируйте `tools/fixtures/metahubs-lms-app-snapshot.json` только через этот сквозной export flow.

## 2. Проверьте поставляемую seeded-поверхность

![Дашборд рантайма LMS с демо-данными](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

Канонический fixture поставляет двуязычный набор данных Learning Portal со следующими сущностями:

- `Classes`
- `Students`
- `Modules`
- `Quizzes`
- `QuizResponses`
- `ModuleProgress`
- `AccessLinks`
- `Enrollments`

Также он поставляет LMS-перечисления, выверенное рабочее меню рантайма, workspace-aware seeded rows и несколько маршрутов гостевого доступа.

## 3. Держите продуктовый контракт fixture стабильным

Импортированный LMS-макет должен оставаться без старых глобальных dashboard widgets и старых widget scripts метахаба:

- без `moduleViewerWidget`
- без `statsViewerWidget`
- без `qrCodeWidget`
- без script `lms-module-viewer`
- без script `lms-stats-viewer`

Не редактируйте payload-ы экспортированного snapshot вручную. Обновляйте генератор или контракт fixture, затем выполняйте повторный экспорт или механически пересобирайте snapshot с пересчитанным `snapshotHash`.

## 4. Опубликуйте импортированный или сгенерированный метахаб

1. Создайте публикацию для LMS-метахаба.
2. Добавьте версию.
3. Выполните синхронизацию до статуса готовности.

## 5. Создайте связанное приложение

При создании приложения включите `workspacesEnabled` и публичный рантайм-доступ.

После создания выполните синхронизацию схемы приложения, чтобы связанное приложение смогло клонировать заполненные LMS-строки в общие рабочие пространства.

## 6. Не пересобирайте демо-строки вручную

Поставляемый fixture уже содержит классы, модули, тесты, ссылки доступа, строки прогресса и workspace seed data, необходимые для MVP-сценария.

Если набор данных нужно изменить, сначала обновите генератор и контракт fixture, а не пересеивайте рантайм-таблицы вручную.

## 7. Проверьте обе рантайм-поверхности

![Экран результата гостевого LMS-потока](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

1. Откройте `/a/:applicationId` и проверьте, что EN и RU аутентифицированный рантайм стартует с раздела `Modules`, не содержит дубля `Workspaces`, а каждый видимый пункт меню открывает реальный раздел или реальный маршрут.
2. Откройте `/public/a/:applicationId/links/:slug` и проверьте EN и RU гостевые учебные потоки.

## Дополнительно

- [Обзор LMS](lms-overview.md)
- [Гостевой доступ LMS](lms-guest-access.md)
- [Туториал по приложению-квизу](quiz-application-tutorial.md)
