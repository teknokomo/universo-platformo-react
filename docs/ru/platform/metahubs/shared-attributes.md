---
description: Справочная страница об общих атрибутах catalog, создаваемых из раздела Common.
---

# Shared Attributes

Shared attributes живут на вкладке Common Attributes и принадлежат виртуальному shared catalog pool, а не строке одного catalog.
Они позволяют одной attribute definition расходиться по нескольким catalog без копирования authoring source.

## Правила design-time

- Создавайте attribute из Common, когда он должен появляться более чем в одном catalog.
- Держите behavior attribute в настройках сущности, а sparse target changes — в override rows.
- Используйте target catalogs только для проверки merged inherited result, а не для прямого редактирования shared config.
- Держите local-only attributes внутри route конкретного catalog, когда наследование не нужно.

## Управление на target-стороне

- Exclusions скрывают shared attribute из выбранных catalogs без удаления базовой строки.
- Active-state overrides могут отключать attribute по catalog, когда shared behavior разрешает деактивацию.
- Position overrides могут переставлять inherited row только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared rows read-only и показывают merged inherited state.

## Publication и runtime

Publication сохраняет shared attributes как first-class shared sections в design snapshot.
Application sync materializes их в обычные runtime field metadata, чтобы runtime tables оставались плоскими.

## Что читать дальше

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Common Section](common-section.md)
- [Метахабы](../metahubs.md)