---
description: Справочная страница о рабочем пространстве ресурсов и его переиспользуемых вкладках в authoring метахаба.
---

# Рабочее пространство ресурсов

Рабочее пространство ресурсов является metahub-уровнем authoring для assets, которые должны переиспользоваться сразу в нескольких target objects.
Она отделена от CRUD отдельных target objects, потому что владеет общим design-time контрактом до того, как publication развернёт его в runtime state.

## Вкладки

- Layouts: shared layouts и entity-specific layout overrides.
- Общие определения полей: общие пулы field definitions для совместимых entity types.
- Общие фиксированные значения: общие пулы fixed values для совместимых entity types.
- Общие значения опций: общие пулы option values для совместимых entity types.
- Общие скрипты: resources-scoped library scripts, импортируемые через `@shared/<codename>`.

## Правила работы

- Открывайте рабочее пространство ресурсов, когда asset должен сначала стать общим, а затем изменяться только sparse-override-ами по target.
- Открывайте target entity, когда нужно проверить итоговый merged inherited result.
- Держите per-target exclusions и active-state изменения sparse, а не клонируйте shared rows.
- Публикуйте и синхронизируйте linked application, чтобы проверить runtime materialization общего asset.

## Результат в runtime

Shared rows остаются обычными design-time rows внутри своих reusable resource pools, но publication materializes их в обычные runtime metadata связанного application.
Это сохраняет reusable authoring и одновременно удерживает runtime tables плоскими и предсказуемыми.

## Что читать дальше

- [Общие определения полей](shared-field-definitions.md)
- [Общие фиксированные значения](shared-fixed-values.md)
- [Общие значения опций](shared-option-values.md)
- [Общие скрипты](shared-scripts.md)
- [Метахабы](../metahubs.md)