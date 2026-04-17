---
description: Справочная страница об общих определениях полей linked collection, создаваемых из рабочего пространства ресурсов.
---

# Общие определения полей

Общие определения полей живут на вкладке «Общие определения полей» в рабочем пространстве ресурсов и принадлежат виртуальному shared linked collection pool, а не строке одной linked collection.
Они позволяют одной field definition расходиться по нескольким linked collections без копирования authoring source.

## Правила design-time

- Создавайте field definition из вкладки «Общие определения полей», когда она должна появляться более чем в одной linked collection.
- Держите behavior field definition в настройках сущности, а sparse target changes — в override rows.
- Используйте target linked collections только для проверки merged inherited result, а не для прямого редактирования shared config.
- Держите local-only field definitions внутри route конкретной linked collection, когда наследование не нужно.

## Управление на target-стороне

- Exclusions скрывают shared field definition из выбранных linked collections без удаления базовой строки.
- Active-state overrides могут отключать field definition по linked collection, когда shared behavior разрешает деактивацию.
- Position overrides могут переставлять inherited row только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared rows read-only и показывают merged inherited state.

## Publication и runtime

Publication сохраняет shared field definitions как first-class shared sections в design snapshot.
Application sync materializes их в обычные runtime field metadata, чтобы runtime tables оставались плоскими.

## Что читать дальше

- [Исключения](exclusions.md)
- [Настройки shared behavior](shared-behavior-settings.md)
- [Рабочее пространство ресурсов](common-section.md)
- [Метахабы](../metahubs.md)
