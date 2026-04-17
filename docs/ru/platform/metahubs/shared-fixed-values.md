---
description: Справочная страница об общих фиксированных значениях наборов, создаваемых из рабочего пространства ресурсов.
---

# Общие фиксированные значения

Общие фиксированные значения живут на вкладке «Общие фиксированные значения» в рабочем пространстве ресурсов и принадлежат виртуальному shared set pool, а не одному набору.
Они позволяют держать одну fixed value definition центральной, пока несколько наборов наследуют один design-time source.

## Правила design-time

- Создавайте fixed value из вкладки «Общие фиксированные значения», когда её должны переиспользовать несколько наборов.
- Держите shared behavior на самой fixed value, а sparse target changes — в override rows.
- Проверяйте inherited state из route target набора, но редактируйте базовую shared row из вкладки «Общие фиксированные значения».
- Используйте local set fixed values только тогда, когда значение не должно расходиться по наборам.

## Управление на target-стороне

- Exclusions убирают inherited fixed value из выбранных наборов без удаления shared source.
- Active-state overrides отключают fixed value по набору только тогда, когда shared behavior это разрешает.
- Position overrides переставляют inherited fixed value только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared fixed values read-only и показывают merged inherited state.

## Publication и runtime

Publication экспортирует shared fixed values в собственной snapshot section.
Runtime сохраняет fixed values на существующем пути snapshot constant и setConstantRef вместо ввода новой runtime table.

## Что читать дальше

- [Исключения](exclusions.md)
- [Настройки shared behavior](shared-behavior-settings.md)
- [Рабочее пространство ресурсов](common-section.md)
- [Метахабы](../metahubs.md)
