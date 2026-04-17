---
description: Архитектурная справка о design-time хранении metahub, shared virtual containers и runtime-flattening.
---

# Схема метахаба

Authoring metahub использует разделённую модель: центральные platform metadata, design-time tables в области metahub и flattened application runtime output.
Функция shared entities добавляет virtual container objects и sparse override rows без появления cloned target data.

## Слои design-time

- Центральные записи metahub живут в platform schemas для discovery, membership и управления publication.
- Каждая ветка metahub владеет design-time tables внутри собственной схемы metahub.
- Shared attributes, constants и values живут в виртуальных Common containers внутри `_mhb_objects`.
- Sparse target differences живут в `_mhb_shared_entity_overrides`.
- Различия widget catalog layout живут в `_mhb_catalog_widget_overrides`.

## Хранение shared entities

- Shared catalog attributes принадлежат `shared-catalog-pool`.
- Shared set constants принадлежат `shared-set-pool`.
- Shared enumeration values принадлежат `shared-enumeration-pool`.
- Базовый shared behavior живёт на shared row, а per-target state остаётся в sparse override rows.

## Publication и runtime

- Snapshot export сохраняет shared sections как first-class части design snapshot.
- Snapshot restore пересоздаёт virtual containers и переназначает shared override rows.
- Publication materializes shared entities в обычные runtime metadata до application sync.
- Applications сохраняют runtime tables плоскими, даже когда design-time authoring остаётся shared.

## Что читать дальше

- [Метахабы](../platform/metahubs.md)
- [Рабочая область Resources](../platform/metahubs/common-section.md)
- [Shared Entity Overrides](../api-reference/shared-entity-overrides.md)