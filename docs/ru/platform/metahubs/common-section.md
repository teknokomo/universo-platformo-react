---
description: Справочная страница о resources workspace и его переиспользуемых вкладках в authoring метахаба.
---

# Рабочая область Resources

Рабочая область Resources является metahub-уровнем authoring для assets, которые должны переиспользоваться сразу в нескольких target objects.
Она отделена от CRUD отдельных target objects, потому что владеет общим design-time контрактом до того, как publication развернёт его в runtime state.

## Вкладки

- Layouts: shared layouts и entity-specific layout overrides.
- Field Definitions: общие пулы field definitions для совместимых entity types.
- Fixed Values: общие пулы fixed values для совместимых entity types.
- Option Values: общие пулы option values для совместимых entity types.
- Scripts: resources-scoped library scripts, импортируемые через `@shared/<codename>`.

## Правила работы

- Открывайте Resources, когда asset должен сначала стать общим, а затем изменяться только sparse-override-ами по target.
- Открывайте target entity, когда нужно проверить итоговый merged inherited result.
- Держите per-target exclusions и active-state изменения sparse, а не клонируйте shared rows.
- Публикуйте и синхронизируйте linked application, чтобы проверить runtime materialization общего asset.

## Результат в runtime

Shared rows остаются обычными design-time rows внутри своих reusable resource pools, но publication materializes их в обычные runtime metadata связанного application.
Это сохраняет reusable authoring и одновременно удерживает runtime tables плоскими и предсказуемыми.

## Что читать дальше

- [Shared Field Definitions](shared-field-definitions.md)
- [Shared Fixed Values](shared-fixed-values.md)
- [Shared Option Values](shared-option-values.md)
- [Shared Scripts](shared-scripts.md)
- [Метахабы](../metahubs.md)