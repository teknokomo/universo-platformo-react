---
description: Объясняет, чем владеют metahubs, как устроены их уровни настроек и как они питают publications и applications.
---

# Метахабы

Metahubs — это design-time источник истины для структур, layout, script и publication-ready content.
Это не просто папки: каждый metahub владеет authoring model, который позже становится publication data и состоянием runtime в application.

## Чем владеет metahub

- branch для design-time evolution;
- catalog, hub, set, enumeration, attribute и другими authoring entities;
- layout и dashboard composition;
- script, прикреплёнными на уровне metahub или entity;
- publication, которые упаковывают текущее approved state.

## Основные поверхности authoring

| Surface | Purpose |
| --- | --- |
| Branches | Отдельные design-time timelines и контролируемая активация. |
| Layouts | Настройка runtime layout zones, widget и view settings. |
| Scripts | Authoring embedded runtime modules, lifecycle handlers и widget code. |
| Publications | Замораживают version, которую можно доставить в applications. |
| Members | Управляют тем, кто может author и manage данный metahub. |

## Уровни настроек вокруг metahubs

Поведение metahub управляется несколькими слоями настроек, и эти слои намеренно разделены.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub common settings | Metahub settings storage | Размер authoring dialogs, fullscreen, resize и close behavior для dialogs в metahub scope. |
| Catalog and runtime settings | Metahub entity config | Runtime columns, layout behavior и поведение представления на уровне catalog. |
| Admin platform policy | Admin settings storage | Будут ли platform `_upl_*` system attributes показаны или принудительно заданы policy. |
| Application settings | Application record | Только dialogs панели управления application, а не dialogs authoring в metahub. |

## Область действия dialog presentation

Metahub dialog settings остаются привязанными к metahub authoring routes, таким как `/metahub/:metahubId/...`.
Они не переопределяют admin dialogs и не переопределяют dialogs панели управления application.
Такое разделение позволяет одной команде держать компактные dialogs authoring metahub, пока другое application использует более крупные окна панели управления.

## Как metahubs питают runtime

1. Создайте структуру, layout и script-ы в metahub.
2. Опубликуйте version, когда design-time state готов.
3. Привяжите или обновите application из этой publication.
4. Дайте application sync материализовать publication в runtime tables и runtime scripts.
5. Откройте опубликованный runtime на `/a/:applicationId`.

## Скрипты и макеты вместе

Сценарий с квизом хорошо показывает, почему именно metahubs остаются единым источником истины.
Скрипт виджета создаётся в metahub, размещение виджета настраивается в его layout, а итоговая publication переносит обе части в связанное application.
Если вы меняете только настройки панели управления application, вы меняете опыт администрирования этого application, а не само поведение квиза, которым владеет metahub.

## Практический порядок чтения

1. Прочитайте [руководство по metahub-скриптам](../guides/metahub-scripting.md), чтобы понять контракт script.
2. Прочитайте [туториал по приложению-квизу](../guides/quiz-application-tutorial.md) для примера квиза, созданного через браузер.
3. Прочитайте [Приложения](applications.md) для части с панелью управления и runtime-доставкой.
