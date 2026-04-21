---
description: Пошаговая настройка канонического LMS metahub, publication, linked application и snapshot fixture.
---

# Настройка LMS

Это руководство описывает поддерживаемый workflow для встроенного LMS template и его канонического fixture Orbital Academy.

## 1. Создайте или пересоберите канонический fixture

1. Используйте generator spec `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
2. Считайте `tools/testing/e2e/support/lmsFixtureContract.ts` источником истины для seeded dataset.
3. Перегенерируйте `tools/fixtures/metahubs-lms-app-snapshot.json` только через этот сквозной export flow.

## 2. Проверьте поставляемую seeded-поверхность

Канонический fixture поставляет двуязычный dataset Orbital Academy со следующими сущностями:

- `Classes`
- `Students`
- `Modules`
- `Quizzes`
- `QuizResponses`
- `ModuleProgress`
- `AccessLinks`
- `Enrollments`

Также он поставляет LMS enumeration, default dashboard widgets и несколько guest-access маршрутов.

## 3. Держите контракт widget scripts стабильным

Импортированный LMS layout ожидает такие канонические widget scripts metahub:

- `lms-module-viewer`
- `lms-stats-viewer`

Не редактируйте exported snapshot script payloads вручную; обновляйте generator и contract, затем выполняйте re-export.

## 4. Опубликуйте импортированный или сгенерированный metahub

1. Создайте publication для LMS metahub.
2. Добавьте version.
3. Выполните sync до статуса ready.

## 5. Создайте linked application

При создании приложения включите `workspacesEnabled` и public runtime access.

После создания выполните sync схемы приложения, чтобы linked app смог клонировать seeded LMS rows в shared workspaces.

## 6. Не пересобирайте demo rows вручную

Поставляемый fixture уже содержит классы, модули, тесты, access links, progress rows и widget content, необходимые для demo.

Если dataset нужно изменить, сначала обновите generator и fixture contract, а не пересеивайте runtime tables вручную.

## 7. Проверьте обе runtime-поверхности

1. Откройте `/a/:applicationId` и проверьте EN и RU dashboard widgets в аутентифицированном runtime.
2. Откройте `/public/a/:applicationId/links/:slug` и проверьте EN и RU guest-learning flows.

## Дополнительно

- [Обзор LMS](lms-overview.md)
- [Гостевой доступ LMS](lms-guest-access.md)
- [Туториал по приложению-квизу](quiz-application-tutorial.md)
