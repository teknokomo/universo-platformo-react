---
description: Справочная страница об общих фиксированных значениях value group, создаваемых из рабочего пространства ресурсов.
---

# Общие фиксированные значения

Общие фиксированные значения живут на вкладке «Общие фиксированные значения» в рабочем пространстве ресурсов и принадлежат виртуальному shared value group pool, а не одному value group.
Они позволяют держать одну fixed value definition центральной, пока несколько value groups наследуют один design-time source.

## Правила design-time

- Создавайте fixed value из вкладки «Общие фиксированные значения», когда её должны переиспользовать несколько value groups.
- Держите shared behavior на самой fixed value, а sparse target changes — в override rows.
- Проверяйте inherited state из route target value group, но редактируйте базовую shared row из вкладки «Общие фиксированные значения».
- Используйте local value group fixed values только тогда, когда значение не должно расходиться по группам.

## Управление на target-стороне

- Exclusions убирают inherited fixed value из выбранных value groups без удаления shared source.
- Active-state overrides отключают fixed value по value group только тогда, когда shared behavior это разрешает.
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
