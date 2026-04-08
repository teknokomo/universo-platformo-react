---
description: Справочная страница об общих константах set, создаваемых из раздела Common.
---

# Shared Constants

Shared constants живут на вкладке Common Constants и принадлежат виртуальному shared set pool, а не одному set.
Они позволяют держать одну constant definition центральной, пока несколько set наследуют один design-time source.

## Правила design-time

- Создавайте constant из Common, когда её должны переиспользовать несколько set.
- Держите shared behavior на самой constant, а sparse target changes — в override rows.
- Проверяйте inherited state из route target set, но редактируйте базовую shared row из Common.
- Используйте local set constants только тогда, когда значение не должно расходиться по наборам.

## Управление на target-стороне

- Exclusions убирают inherited constant из выбранных set без удаления shared source.
- Active-state overrides отключают constant по set только тогда, когда shared behavior это разрешает.
- Position overrides переставляют inherited constant только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared constants read-only и показывают merged inherited state.

## Publication и runtime

Publication экспортирует shared constants в собственной snapshot section.
Runtime сохраняет constants на существующем пути snapshot constant и setConstantRef вместо ввода новой runtime table.

## Что читать дальше

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Common Section](common-section.md)
- [Метахабы](../metahubs.md)