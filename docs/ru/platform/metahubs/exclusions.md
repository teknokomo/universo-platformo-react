---
description: Руководство по sparse-механизму exclusions и override-ов, используемому общими сущностями.
---

# Exclusions

Exclusions — это sparse target-specific overrides, а не cloned copies shared rows.
Они позволяют одному shared source оставаться центральным, пока выбранные target-ы отказываются от наследования.

## Как это работает

- Shared source row остаётся в общем пуле рабочего пространства ресурсов.
- Target-specific override rows записывают различия по exclusion, active-state и sort-order.
- Очистка override возвращает target к inherited default behavior.
- Target lists читают merged result вместо редактирования shared source на месте.

## Правила работы

- Настраивайте exclusions из рабочего пространства ресурсов во время редактирования shared row, а не из inherited target row.
- Используйте exclusions только тогда, когда `sharedBehavior.canExclude` всё ещё разрешает target opt-out.
- Держите local-only entities локальными вместо создания shared row с исключением везде.
- Проверяйте included и excluded target-ы перед publication, когда shared row влияет на критичное runtime behavior.

## Что читать дальше

- [Общие определения полей](shared-field-definitions.md)
- [Общие фиксированные значения](shared-fixed-values.md)
- [Общие значения опций](shared-option-values.md)
- [Настройки shared behavior](shared-behavior-settings.md)