---
description: Справочная страница об общих значениях enumeration, создаваемых из раздела Common.
---

# Shared Values

Shared values живут на вкладке Common Values и принадлежат виртуальному shared enumeration pool, а не одному enumeration.
Они позволяют одной enumeration value definition оставаться reusable, пока несколько enumeration наследуют один source row.

## Правила design-time

- Создавайте value из Common, когда один и тот же смысл должен появляться более чем в одном enumeration.
- Держите shared behavior на shared row, а sparse target changes — в override rows.
- Используйте target enumerations для проверки inherited state, но оставляйте базовый shared authoring flow в Common.
- Используйте local enumeration values только тогда, когда одному enumeration нужно значение без наследования другими.

## Управление на target-стороне

- Exclusions скрывают inherited value из выбранных enumeration без удаления shared source.
- Active-state overrides отключают inherited value только тогда, когда shared behavior разрешает деактивацию.
- Position overrides переставляют inherited value только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared values read-only и показывают merged inherited result.

## Publication и runtime

Publication экспортирует shared enumeration values в собственной snapshot section.
Runtime нормализует duplicated inherited value ids по target enumeration, чтобы runtime metadata и seeded refs оставались детерминированными.

## Что читать дальше

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Common Section](common-section.md)
- [Метахабы](../metahubs.md)