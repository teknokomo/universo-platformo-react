---
description: Справочная страница об общих значениях параметров перечислений, создаваемых из рабочего пространства ресурсов.
---

# Общие значения опций

Общие значения опций живут на вкладке «Общие значения опций» в рабочем пространстве ресурсов и принадлежат виртуальному shared enumeration pool, а не одному перечислению.
Они позволяют одной option value definition оставаться reusable, пока несколько перечислений наследуют один source row.

## Правила design-time

- Создавайте option value из вкладки «Общие значения опций», когда один и тот же смысл должен появляться более чем в одном перечислении.
- Держите shared behavior на shared row, а sparse target changes — в override rows.
- Используйте target перечисления для проверки inherited state, но оставляйте базовый shared authoring flow во вкладке «Общие значения опций».
- Используйте local enumeration values только тогда, когда одному перечислению нужно значение без наследования другими.

## Управление на target-стороне

- Exclusions скрывают inherited option value из выбранных перечислений без удаления shared source.
- Active-state overrides отключают inherited option value только тогда, когда shared behavior разрешает деактивацию.
- Position overrides переставляют inherited option value только тогда, когда shared behavior не заблокирован.
- Target lists сохраняют shared option values read-only и показывают merged inherited result.

## Publication и runtime

Publication экспортирует shared option values в собственной snapshot section.
Runtime нормализует duplicated inherited option value ids по target перечислению, чтобы runtime metadata и seeded refs оставались детерминированными.

## Что читать дальше

- [Исключения](exclusions.md)
- [Настройки shared behavior](shared-behavior-settings.md)
- [Рабочее пространство ресурсов](common-section.md)
- [Метахабы](../metahubs.md)
