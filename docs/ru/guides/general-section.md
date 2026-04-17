---
description: Как использовать рабочее пространство ресурсов в metahub как реальную точку входа для layout, reusable metadata resources и shared library scripts.
---

# Рабочее пространство ресурсов

Страница Resources является реальной точкой входа для настройки layout, reusable metadata resources и shared library scripts внутри metahub.
Живая навигация теперь ведёт прямо на `/resources`, поэтому активный контракт больше не зависит от legacy Common или surface `/layouts`.

## Что находится здесь

- shared layouts, которые формируют reusable runtime-композицию;
- общие пулы field definitions, fixed values и option values, которые могут наследоваться совместимыми entity types;
- навигация к entity-specific layout и sparse overrides;
- скрипты resources/library, которые отдают переиспользуемые helper-ы через `@shared/<codename>`;
- общее view behavior, которое должно жить рядом с настройкой layout, а не в отдельных admin settings.

## Навигационный контракт

1. Откройте metahub.
2. Используйте элемент боковой панели Resources.
3. Переключайтесь между вкладками Layouts, Field Definitions, Fixed Values, Option Values и Scripts в зависимости от нужного общего asset.
4. Откройте target entity и перейдите на его собственный route, когда нужно проверить merged inherited rows или entity-specific layout behavior.

## Поток работы с общими ресурсами

1. Создавайте общие field definitions, fixed values или option values на соответствующей вкладке Resources.
2. Используйте вкладки Presentation и Exclusions в диалоге, когда нужны behavior locks или target-specific exclusions.
3. Откройте target entity, чтобы проверить merged inherited rows и read-only action gating.
4. Публикуйте и синхронизируйте linked application, когда runtime должен materialize общие rows.

## Поток работы с shared scripts

1. Откройте Resources -> Scripts, чтобы писать reusable library helper-ы.
2. Импортируйте эти helper-ы из consumer scripts через `@shared/<codename>`.
3. Держите libraries чистыми: они компилируются для dependency resolution, а не как прямые runtime entrypoints.
4. Публикуйте version и проверяйте consuming widget или module на `/a/:applicationId`.

## Fail-Closed правила Resources

- shared rows остаются read-only в списках target entity, а per-target overrides нужно настраивать через вкладки Presentation и Exclusions в Resources;
- Resources -> Scripts принимает только reusable library authoring, поэтому shared helper-ы нельзя создавать как drafts с ролями widget, module или lifecycle;
- удаление shared library или смена её codename завершаются fail-closed, пока consumer scripts всё ещё импортируют `@shared/<codename>`;
- циклы `@shared/*` отклоняются уже во время authoring, поэтому publication не отгружает неоднозначные shared dependencies.

## Почему Resources продолжает расти

Платформа теперь держит cross-cutting-настройку metahub внутри одной dedicated surface Resources.
Это убирает разделение layout, shared-resource и shared-library работы между разными menu items и оставляет место для будущих resource-level вкладок без нового navigation refactor.

## Что читать дальше

- [Макеты каталогов](catalog-layouts.md)
- [Скрипты Metahub](metahub-scripting.md)
- [Настройки отображения шаблона приложения](app-template-views.md)
- [Метахабы](../platform/metahubs.md)