---
description: Справочный обзор scripting-поверхностей metahub, scope-ов и потока поставки.
---

# Metahub Scripts

Metahub scripts — это design-time scripting surface, принадлежащая metahub до того, как publication превращает consumer scripts в runtime entries.
Один и тот же scripting contract охватывает Common libraries, логику уровня metahub и object-attached consumers.

## Поверхности

- Common -> Scripts author-ит import-only helper-ы `general/library`.
- Скрипты уровня metahub author-ят reusable runtime logic, не привязанную к одному object.
- Object-attached scripts держат поведение рядом с hub, catalog, set, enumeration или attribute.
- Publications упаковывают активные consumer scripts для application sync и runtime execution.

## Правила поставки

- Держите shared helper code в Common libraries и импортируйте её через `@shared/<codename>`.
- Держите executable consumer-ы на scope metahub или object, чтобы runtime attachment оставался явным.
- Публикуйте и синхронизируйте приложение до проверки browser или runtime behavior.
- Считайте backend validation errors нарушением контракта, а не необязательными warning-ами.

## Что читать дальше

- [Shared Scripts](shared-scripts.md)
- [Script Scopes](script-scopes.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)