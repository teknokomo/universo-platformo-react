---
description: Как использовать раздел Common в metahub как реальную точку входа для layout, shared entities и shared library scripts.
---

# Раздел Common

Страница Common является реальной точкой входа для настройки layout, shared entities и shared library scripts внутри metahub.
Legacy-ссылки `/layouts` по-прежнему работают, но перенаправляют в Common, чтобы старые закладки не ломались.

## Что находится здесь

- глобальные layout, которые формируют общую runtime-композицию;
- общие attributes, constants и values перечислений, которые могут наследоваться target objects;
- навигация к catalog-specific layout и sparse overrides;
- скрипты `general/library`, которые отдают переиспользуемые helper-ы через `@shared/<codename>`;
- общее view behavior, которое должно жить рядом с настройкой layout, а не в отдельных admin settings.

## Навигационный контракт

1. Откройте metahub.
2. Используйте элемент боковой панели Common.
3. Переключайтесь между вкладками Layouts, Attributes, Constants, Values и Scripts в зависимости от нужного общего ресурса.
4. Откройте catalog и перейдите на его собственный route, когда нужно проверить merged inherited rows или catalog-specific layout behavior.

## Поток работы с shared entities

1. Создавайте общие attributes, constants или values на соответствующей вкладке Common.
2. Используйте вкладки Presentation и Exclusions в диалоге, когда нужны behavior locks или target-specific exclusions.
3. Откройте target catalog, set или enumeration, чтобы проверить merged inherited rows и read-only action gating.
4. Публикуйте и синхронизируйте linked application, когда runtime должен materialize общие rows.

## Поток работы с shared scripts

1. Откройте Common -> Scripts, чтобы писать helper-ы `general/library`.
2. Импортируйте эти helper-ы из consumer scripts через `@shared/<codename>`.
3. Держите libraries чистыми: они компилируются для dependency resolution, а не как прямые runtime entrypoints.
4. Публикуйте version и проверяйте consuming widget или module на `/a/:applicationId`.

## Fail-Closed правила Common

- shared rows остаются read-only в target object lists, а per-target overrides нужно настраивать через вкладки Presentation и Exclusions в Common;
- Common -> Scripts принимает только authoring `general/library`, поэтому reusable helper-ы нельзя создавать как drafts с ролями widget, module или lifecycle;
- удаление shared library или смена её codename завершаются fail-closed, пока consumer scripts всё ещё импортируют `@shared/<codename>`;
- циклы `@shared/*` отклоняются уже во время authoring, поэтому publication не отгружает неоднозначные Common dependencies.

## Почему Common продолжает расти

Платформа теперь держит cross-cutting-настройку metahub внутри одной tabbed surface Common.
Это убирает разделение layout, shared-entity и shared-library работы между разными menu items и оставляет место для будущих вкладок Common без нового navigation refactor.

## Что читать дальше

- [Макеты каталогов](catalog-layouts.md)
- [Скрипты Metahub](metahub-scripting.md)
- [Настройки отображения шаблона приложения](app-template-views.md)
- [Метахабы](../platform/metahubs.md)