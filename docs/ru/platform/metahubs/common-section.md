---
description: Справочная страница о разделе Common и его отдельных вкладках в authoring метахаба.
---

# Раздел Common

Раздел Common является metahub-уровнем authoring для ресурсов, которые должны переиспользоваться сразу в нескольких target objects.
Он отделён от CRUD отдельных target objects, потому что владеет общим design-time контрактом до того, как publication развернёт его в runtime state.

## Вкладки

- Layouts: global layouts и catalog-specific layout overlays.
- Attributes: общие атрибуты catalog, наследуемые catalog objects.
- Constants: общие константы set, наследуемые наборами.
- Values: общие значения enumeration, наследуемые объектами перечислений.
- Scripts: Common/general library scripts, импортируемые через `@shared/<codename>`.

## Правила работы

- Открывайте Common, когда ресурс должен сначала стать общим, а затем изменяться только sparse-override-ами по target.
- Открывайте target catalog, set или enumeration, когда нужно проверить итоговый merged inherited result.
- Держите per-target exclusions и active-state изменения sparse, а не клонируйте shared rows.
- Публикуйте и синхронизируйте linked application, чтобы проверить runtime materialization ресурса из Common.

## Результат в runtime

Shared rows остаются обычными design-time rows внутри своих виртуальных Common pools, но publication materializes их в обычные runtime metadata связанного application.
Это сохраняет reusable authoring и одновременно удерживает runtime tables плоскими и предсказуемыми.

## Что читать дальше

- [Shared Attributes](shared-attributes.md)
- [Shared Constants](shared-constants.md)
- [Shared Values](shared-values.md)
- [Shared Scripts](shared-scripts.md)
- [Метахабы](../metahubs.md)