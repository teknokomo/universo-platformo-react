---
description: Справочная страница об общих значениях параметров option list, создаваемых из раздела Common.
---

# Shared Option Values

Shared option values живут на вкладке Common Option Values и принадлежат виртуальному shared option list pool, а не одному option list.
Они позволяют одной option value definition оставаться reusable, пока несколько option lists наследуют один source row.

## Правила design-time

- Создавайте option value из Common, когда один и тот же смысл должен появляться более чем в одном option list.
- Держите shared behavior на shared row, а sparse target changes — в override rows.
- Используйте target option lists для проверки inherited state, но оставляйте базовый shared authoring flow в Common.
- Используйте local option list values только тогда, когда одному option list нужно значение без наследования другими.

## Управление на target-стороне

- Exclusions скрывают inherited option value из выбранных option lists без удаления shared source.
- Active-state overrides отключают inherited option value только тогда, когда shared behavior разрешает деактивацию.
- Position overrides переставляют inherited option value только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared option values read-only и показывают merged inherited result.

## Publication и runtime

Publication экспортирует shared option values в собственной snapshot section.
Runtime нормализует duplicated inherited option value ids по target option list, чтобы runtime metadata и seeded refs оставались детерминированными.

## Что читать дальше

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Рабочая область Resources](common-section.md)
- [Метахабы](../metahubs.md)
