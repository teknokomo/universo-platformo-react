---
description: Объясняет, чем владеют metahubs, как устроены раздел Common и уровни настроек, и как publications питают applications.
---

# Метахабы

Метахабы являются design-time источником истины для структур, layout в разделе Common, скриптов и контента, готового к publication.
Это не просто папки: каждый metahub владеет моделью настройки, которая позже становится publication data и состоянием runtime в application.

## Чем владеет metahub

- ветвями для design-time evolution;
- catalog, hub, set, enumeration, attribute и другими design-time entities;
- разделом Common, включая global layouts, shared attributes/constants/values и catalog-specific layout overlays;
- scripts, прикреплёнными на уровне Common/general, metahub или entity;
- publications, которые упаковывают текущее approved state.

## Основные поверхности authoring

| Surface | Purpose |
| --- | --- |
| Common | Позволяет из одной tabbed surface настраивать global layouts, shared entities, catalog-specific layout variants и общее view behavior. |
| Branches | Отдельные design-time timelines и контролируемая активация. |
| Scripts | Позволяют создавать embedded runtime modules, helper-ы `general/library`, lifecycle handlers и widget code. |
| Publications | Замораживают version, которую можно доставить в applications. |
| Members | Управляют тем, кто может настраивать и администрировать metahub. |

## Уровни настроек вокруг metahubs

Поведение metahub управляется несколькими слоями настроек, и эти слои намеренно разделены.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub common settings | Metahub settings storage | Размер dialog-окон настройки, fullscreen, resize и close behavior для metahub-scoped dialogs. |
| Global layout behavior | Selected global layout config | Runtime view settings catalog по умолчанию и поведение create/edit/copy surface до появления первого custom layout у catalog. |
| Catalog layout behavior | Selected catalog layout config | `showCreateButton`, `searchMode` и поведение create/edit/copy surface для выбранного layout catalog. |
| Application settings | Application record | Только dialogs панели управления application, а не dialogs настройки в metahub. |

## Область действия раздела Common

Реальная точка входа для cross-cutting-настройки теперь находится на tabbed page Common, а legacy ссылки `/layouts` перенаправляются туда.
Layout catalog остаются sparse, shared entities остаются централизованными, а Common/library scripts остаются переиспользуемыми через импорты `@shared/<codename>`.
Это сохраняет разделение между настройкой в metahub, admin dialogs и dialogs панели управления application.

## Как metahubs питают runtime

1. Создайте структуру, Common layouts, shared entities и scripts в metahub.
2. Опубликуйте version, когда design-time state готов.
3. Привяжите или обновите application из этой publication.
4. Дайте application sync материализовать flattened runtime layouts, widgets и scripts в application tables.
5. Откройте опубликованный runtime на `/a/:applicationId`.

## Скрипты и макеты вместе

Сценарий с квизом хорошо показывает, почему именно metahubs остаются единым источником истины.
Shared library helper создаётся в Common, consumer-script виджета создаётся на уровне metahub, размещение виджета настраивается в модели layout раздела Common, а итоговая publication переносит все три части в связанное application.
Пока у catalog нет первого custom layout, runtime behavior берётся из выбранного global layout; после этого выбранный layout catalog начинает управлять runtime для create/edit/copy surface.

## Практический порядок чтения

1. Прочитайте [руководство по metahub-скриптам](../guides/metahub-scripting.md), чтобы понять контракт scripts.
2. Прочитайте [туториал по приложению-квизу](../guides/quiz-application-tutorial.md) для примера квиза, созданного через браузер.
3. Прочитайте [Приложения](applications.md) для части с панелью управления и runtime-доставкой.
