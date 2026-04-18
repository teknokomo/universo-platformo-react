---
description: Объясняет, чем владеют metahubs, как устроено рабочее пространство ресурсов и уровни настроек, и как publications питают applications.
---

# Метахабы

Метахабы являются design-time источником истины для структур, assets в рабочем пространстве ресурсов, скриптов и контента, готового к publication.
Это не просто папки: каждый metahub владеет моделью настройки, которая позже становится publication data и состоянием runtime в application.

## Чем владеет metahub

- ветвями для design-time evolution;
- entity types, entity instances, field definitions, fixed values, records и другими authoring resources;
- выделенным рабочим пространством ресурсов, включая shared layouts, reusable metadata pools и reusable scripts;
- scripts, прикреплёнными на уровне resources, metahub или entity;
- publications, которые упаковывают текущее approved state.

## Основные поверхности authoring

| Surface | Purpose |
| --- | --- |
| Resources | Позволяет из одной dedicated surface настраивать shared layouts, reusable metadata resources и reusable scripts. |
| Entities | Позволяет настраивать platform standard kinds и custom kinds из единого entity workspace. |
| Branches | Отдельные design-time timelines и контролируемая активация. |
| Publications | Замораживают version, которую можно доставить в applications. |
| Members | Управляют тем, кто может настраивать и администрировать metahub. |

## Уровни настроек вокруг metahubs

Поведение metahub управляется несколькими слоями настроек, и эти слои намеренно разделены.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub dialog settings | Metahub settings storage | Размер dialog-окон настройки, fullscreen, resize и close behavior для metahub-scoped dialogs. |
| Shared layout behavior | Selected shared layout config | Runtime view settings по умолчанию и поведение create/edit/copy до появления первого layout override у entity. |
| Entity layout behavior | Selected entity layout config | `showCreateButton`, `searchMode` и поведение create/edit/copy для выбранного layout entity. |
| Application settings | Application record | Только dialogs панели управления application, а не dialogs настройки в metahub. |

## Область действия рабочего пространства ресурсов

Реальная точка входа для cross-cutting-настройки теперь находится в выделенной рабочей области `/resources`.
Shared layouts остаются централизованными, reusable metadata pools остаются переиспользуемыми, а resources scripts сохраняют shared-контракт импортов `@shared/<codename>`.
Это сохраняет разделение между настройкой в metahub, admin dialogs и dialogs панели управления application.

![Рабочее пространство ресурсов](../.gitbook/assets/entities/resources-workspace.png)

## Как metahubs питают runtime

1. Создайте структуру, shared layouts, reusable metadata resources и scripts в metahub.
2. Опубликуйте version, когда design-time state готов.
3. Привяжите или обновите application из этой publication.
4. Дайте application sync материализовать flattened runtime layouts, widgets и scripts в application tables.
5. Откройте опубликованный runtime на `/a/:applicationId`.

## Скрипты и макеты вместе

Сценарий с квизом хорошо показывает, почему именно metahubs остаются единым источником истины.
Shared library helper создаётся в Resources, consumer-script виджета создаётся на уровне metahub, размещение виджета настраивается в модели shared layout, а итоговая publication переносит все три части в связанное application.
Пока у entity нет первого layout override, runtime behavior берётся из выбранного shared layout; после этого выбранный layout entity начинает управлять runtime для create/edit/copy behavior.

## Практический порядок чтения

1. Прочитайте [руководство по metahub-скриптам](../guides/metahub-scripting.md), чтобы понять контракт scripts.
2. Прочитайте [туториал по приложению-квизу](../guides/quiz-application-tutorial.md) для примера квиза, созданного через браузер.
3. Прочитайте [Приложения](applications.md) для части с панелью управления и runtime-доставкой.
