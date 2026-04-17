---
description: Справочная страница о точной разнице между библиотеками рабочего пространства ресурсов, metahub scripts и object-attached scripts.
---

# Script Scopes

Metahub scripting использует один manifest contract, но scope привязки определяет, где script может жить и как он применяется.
Сначала выбирайте scope, а затем совместимую module role и runtime behavior.

## Матрица scope

| Scope | Allowed roles | Direct runtime entrypoint | Typical use |
| --- | --- | --- | --- |
| `general` | `library` only | No | Shared helper-ы рабочего пространства ресурсов, импортируемые через `@shared/<codename>`. |
| `metahub` | `module`, `lifecycle`, `widget` | Yes | Runtime logic и widgets на уровне metahub. |
| `hub` / `catalog` / `set` / `enumeration` / `attribute` | `module`, `lifecycle`, `widget` | Yes | Object-attached consumer-ы рядом с одной design surface. |

## Правила выбора

- Выбирайте `general/library`, когда code должен переиспользоваться и импортироваться другими scripts.
- Выбирайте executable scopes, когда script должен прикрепляться к metahub или одному object и участвовать в runtime delivery.
- Не используйте decorators и runtime ctx access внутри `library` code.
- Публикуйте и синхронизируйте приложение перед проверкой поведения выбранного consumer-а в linked application.

## Что читать дальше

- [Shared Scripts](shared-scripts.md)
- [Metahub Scripts](scripts.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)