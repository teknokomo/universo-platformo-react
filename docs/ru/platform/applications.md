---
description: Описывает, как applications потребляют publications, открывают настройки панели управления и отдают финальный runtime.
---

# Приложения

Applications — это исполняемая поверхность доставки платформы.
Metahub подготавливает исходную модель, publication фиксирует release candidate, а application превращает этот опубликованный контракт в управляемый runtime.

## Чем владеет application

- linked publication reference, которая используется для доставки runtime;
- состояние connector и schema sync;
- runtime members и граница доступа;
- настройки панели управления application;
- финальный runtime route по адресу `/a/:applicationId`.

## Основные поверхности

| Surface | Purpose |
| --- | --- |
| Overview | Карточки состояния и общая health-сводка для linked runtime. |
| Connectors | Управляют связью с publication и schema sync. |
| Migrations | Показывают состояние и историю runtime schema. |
| Settings | Настраивают поведение панели управления application и workspace limits. |
| Runtime | Отдаёт опубликованную пользовательскую поверхность. |

## Настройки панели управления

Страница application settings теперь содержит реальный contract для General settings вместо временного placeholder copy.
Эти settings хранятся в `applications.cat_applications.settings` и возвращаются через flows списка, деталей и обновления application.

| Setting | Meaning |
| --- | --- |
| Dialog size preset | Базовая ширина dialog в application-admin surface. |
| Allow fullscreen | Можно ли разворачивать dialog в fullscreen. |
| Allow resize | Доступен ли resize handle. |
| Close behavior | Остаются ли dialog strict-modal или разрешают закрытие по клику вне окна. |
| Workspace limits | Лимиты строк по рабочим пространствам для поддерживаемых catalog. |

## Граница области действия

Application dialog settings влияют на application control panel под `/a/:applicationId/admin`.
Они не меняют публичный runtime на `/a/:applicationId`.
Также они не заменяют metahub authoring settings и глобальные dialog settings на `/admin`.

## Workspace-aware runtime model

Когда `workspacesEnabled` включён, рабочие данные runtime привязываются к personal workspace.
Owner и member получают workspace во время bootstrap или выдачи доступа, runtime rows разрешаются внутри этого workspace, а поддерживаемые catalog limits применяются на уровне workspace, а не глобально.
Так applications остаются частью общей платформенной модели совместной ERP- и CMS-подобной работы с runtime data.

## Порядок поставки

1. Свяжите application с publication.
2. Запустите schema sync или создайте runtime schema, если она ещё не готова.
3. Откройте Application Settings, чтобы настроить поведение панели управления и workspace limits.
4. Используйте Connectors, Migrations и другие диалоги панели управления с сохранённым presentation contract.
5. Откройте финальный runtime route, чтобы проверить опубликованный пользовательский опыт.

## Пример с квизом

В сценарии с квизом metahub владеет скриптом виджета и его размещением в layout, а application отвечает за доставку runtime и поведение панели управления.
Это значит, что вопросы квиза и размещение виджета приходят из publication, а размер и поведение закрытия диалога connector задаются записью настроек application.
Сценарий копирования сохраняет эти настройки application, поэтому скопированные applications получают то же поведение диалогов панели управления.

## Связь с админкой

Раздел admin может задавать глобальные политики платформы, но настройки application остаются локальными для каждого application.
Используйте admin, когда нужно платформенное управление на общем уровне.
Используйте настройки application, когда одна панель управления application должна вести себя иначе, чем другая.

Продолжайте с [туториалом по приложению-квизу](../guides/quiz-application-tutorial.md), чтобы пройти конкретный сквозной сценарий в браузере.
