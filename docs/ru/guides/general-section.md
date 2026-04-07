---
description: Как использовать раздел Common в metahub как реальную точку входа для глобальных layout и навигации к layout catalog.
---

# Common Section

Страница Common является реальной точкой входа для authoring layout внутри metahub.
Legacy-ссылки `/layouts` по-прежнему работают, но перенаправляют в Common, чтобы старые bookmarks не ломались.

## What Lives Here

- глобальные layout, которые формируют общий runtime composition;
- навигация к catalog-specific layout variants;
- общее view behavior, которое должно жить рядом с authoring layout, а не в отдельных admin settings.

## Navigation Contract

1. Откройте metahub.
2. Используйте sidebar item Common.
3. Оставайтесь на вкладке Layouts, чтобы управлять глобальными layout.
4. Откройте catalog и перейдите в его список layout, когда нужен override.

## Global Layout Workflow

1. Создайте или откройте global layout через Common -> Layouts.
2. Настройте zones, widgets и application view settings.
3. Отметьте нужный layout как active или default для глобального fallback.
4. Используйте detail view layout, чтобы проверить размещение widgets перед publication.

## Why Layouts Moved

Платформа теперь держит authoring layout внутри одной tabbed surface Common.
Это убирает разделение metahub-level presentation work между разными menu items и оставляет место для будущих вкладок General без нового navigation refactor.

## Related Reading

- [Catalog Layouts](catalog-layouts.md)
- [Настройки отображения шаблона приложения](app-template-views.md)
- [Метахабы](../platform/metahubs.md)