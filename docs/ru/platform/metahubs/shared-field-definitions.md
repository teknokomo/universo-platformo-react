---
description: Справочная страница об общих определениях полей каталогов, создаваемых из рабочего пространства ресурсов.
---

# Общие определения полей

Общие определения полей живут на вкладке «Общие определения полей» в рабочем пространстве ресурсов и принадлежат виртуальному shared catalog pool, а не строке одного каталога.
Они позволяют одной field definition расходиться по нескольким каталогам без копирования authoring source.

## Правила design-time

- Создавайте field definition из вкладки «Общие определения полей», когда она должна появляться более чем в одном каталоге.
- Держите behavior field definition в настройках сущности, а sparse target changes — в override rows.
- Используйте target каталоги только для проверки merged inherited result, а не для прямого редактирования shared config.
- Держите local-only field definitions внутри route конкретного каталога, когда наследование не нужно.

## Управление на target-стороне

- Exclusions скрывают shared field definition из выбранных каталогов без удаления базовой строки.
- Active-state overrides могут отключать field definition по каталогу, когда shared behavior разрешает деактивацию.
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
