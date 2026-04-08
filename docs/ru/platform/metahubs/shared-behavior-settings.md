---
description: Справочная страница о canDeactivate, canExclude и positionLocked для shared entities и inherited widgets.
---

# Shared Behavior Settings

Shared behavior settings определяют, какие sparse per-target changes разрешены после того, как row становится shared.
Они сохраняют базовый shared design reusable и при этом позволяют target-ам входить в контролируемое расхождение.

## Настройки

| Setting | Meaning | Effect |
| --- | --- | --- |
| `canDeactivate` | Target-ы могут отключать inherited row. | Overrides с `isActive=false` разрешены только когда это true. |
| `canExclude` | Target-ы могут убирать inherited row из своего merged view. | Exclusion overrides разрешены только когда это true. |
| `positionLocked` | Target-ы не могут переставлять inherited row. | Sort-order overrides отклоняются, пока это true. |

## Правила хранения

- Shared attributes и constants сохраняют `sharedBehavior` в `uiConfig.sharedBehavior`.
- Shared enumeration values сохраняют `sharedBehavior` в `presentation.sharedBehavior`.
- Target-specific state по-прежнему живёт в sparse override rows вместо копирования в базовую shared row.
- Inherited widgets используют ту же behavior model через config базового widget и sparse catalog-widget overrides.

## Что читать дальше

- [Exclusions](exclusions.md)
- [Shared Attributes](shared-attributes.md)
- [Shared Constants](shared-constants.md)
- [Shared Values](shared-values.md)