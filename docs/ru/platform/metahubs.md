---
description: Объясняет, чем владеют metahubs, как устроены General section и уровни настроек, и как publications питают applications.
---

# Метахабы

Метахабы являются design-time источником истины для структур, layout в разделе General, скриптов и контента, готового к publication.
Это не просто папки: каждый metahub владеет authoring model, который позже становится publication data и состоянием runtime в application.

## Чем владеет metahub

- branch для design-time evolution;
- catalog, hub, set, enumeration, attribute и другими authoring entities;
- разделом General, включая глобальные layout и catalog-specific layout overlays;
- script, прикреплёнными на уровне metahub или entity;
- publication, которые упаковывают текущее approved state.

## Основные поверхности authoring

| Surface | Purpose |
| --- | --- |
| General | Позволяет из одной tabbed surface настраивать глобальные layout, catalog-specific layout variants и общее view behavior. |
| Branches | Отдельные design-time timelines и контролируемая активация. |
| Scripts | Authoring embedded runtime modules, lifecycle handlers и widget code. |
| Publications | Замораживают version, которую можно доставить в applications. |
| Members | Управляют тем, кто может author и manage данный metahub. |

## Уровни настроек вокруг metahubs

Поведение metahub управляется несколькими слоями настроек, и эти слои намеренно разделены.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub common settings | Metahub settings storage | Размер authoring dialogs, fullscreen, resize и close behavior для dialogs в metahub scope. |
| Catalog runtime settings | Metahub entity config | Runtime columns catalog и fallback behavior, используемое до появления первого custom layout у catalog. |
| Catalog layout behavior | Selected catalog layout config | `showCreateButton`, `searchMode` и поведение create/edit/copy surface для выбранного layout catalog. |
| Application settings | Application record | Только dialogs панели управления application, а не dialogs authoring в metahub. |

## Область действия General section

Реальная точка входа для authoring layout теперь находится на tabbed page General, а legacy ссылки `/layouts` перенаправляются туда.
Layout catalog остаются sparse: они наследуются от выбранного global base layout, хранят только overrides и при необходимости могут содержать widgets, принадлежащие только catalog.
Это сохраняет разделение между authoring в metahub, admin dialogs и dialogs панели управления application.

## Как metahubs питают runtime

1. Создайте структуру, General layouts и script-ы в metahub.
2. Опубликуйте version, когда design-time state готов.
3. Привяжите или обновите application из этой publication.
4. Дайте application sync материализовать flattened runtime layouts, widgets и scripts в application tables.
5. Откройте опубликованный runtime на `/a/:applicationId`.

## Скрипты и макеты вместе

Сценарий с квизом хорошо показывает, почему именно metahubs остаются единым источником истины.
Скрипт виджета создаётся в metahub, размещение виджета настраивается в модели layout раздела General, а итоговая publication переносит обе части в связанное application.
Пока у catalog нет первого custom layout, runtime behavior берётся из catalog runtime settings; после этого выбранный layout catalog начинает владеть поведением runtime для create/edit/copy surface.

## Практический порядок чтения

1. Прочитайте [руководство по metahub-скриптам](../guides/metahub-scripting.md), чтобы понять контракт script.
2. Прочитайте [туториал по приложению-квизу](../guides/quiz-application-tutorial.md) для примера квиза, созданного через браузер.
3. Прочитайте [Приложения](applications.md) для части с панелью управления и runtime-доставкой.
