---
description: Справочный обзор scripting-поверхностей metahub, scope-ов и потока поставки.
---

# Metahub Scripts

Metahub scripts — это design-time scripting surface, принадлежащая metahub до того, как publication превращает consumer scripts в runtime entries.
Один и тот же scripting contract охватывает библиотеки рабочего пространства ресурсов, логику уровня metahub и object-attached consumers.

## Поверхности

- Вкладка Scripts в рабочем пространстве ресурсов author-ит import-only helper-ы `general/library`.
- Скрипты уровня metahub author-ят reusable runtime logic, не привязанную к одному object.
- Object-attached scripts держат поведение рядом с hub, catalog, set, enumeration или attribute.
- Publications упаковывают активные consumer scripts для application sync и runtime execution.

## Правила поставки

- Держите shared helper code в библиотеках рабочего пространства ресурсов и импортируйте её через `@shared/<codename>`.
- Держите executable consumer-ы на scope metahub или object, чтобы runtime attachment оставался явным.
- Публикуйте и синхронизируйте приложение до проверки browser или runtime behavior.
- Считайте backend validation errors нарушением контракта, а не необязательными warning-ами.

## Что читать дальше

- [Общие скрипты](shared-scripts.md)
- [Области скриптов](script-scopes.md)
- [Руководство по скриптам Metahub](../../guides/metahub-scripting.md)
- [Система скриптов](../../architecture/scripting-system.md)