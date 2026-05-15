---
description: Architecture reference for metahub design-time storage, shared virtual containers, and runtime flattening.
---

# Metahub Schema

Metahub authoring uses a split model: central platform metadata, metahub-scoped design tables, and flattened application runtime output.
The shared-entity feature adds virtual container objects and sparse override rows without introducing cloned target data.

![Shared components in Resources](../.gitbook/assets/entities/shared-components.png)

## Design-Time Layers

- Central metahub records live in platform schemas for discovery, membership, and publication management.
- Each metahub branch owns design-time tables inside its metahub schema.
- Shared components, constants, and values live in virtual Common containers inside `_mhb_objects`.
- Sparse target differences live in `_mhb_shared_entity_overrides`.
- Entity-scoped layout widget differences live in `_mhb_layout_widget_overrides`.

## Shared Entity Storage

- Shared object components belong to `shared-object-pool`.
- Shared set constants belong to `shared-set-pool`.
- Shared enumeration values belong to `shared-enumeration-pool`.
- Base shared behavior lives on the shared row, while per-target state stays in sparse override rows.

## Publication And Runtime

- Snapshot export keeps shared sections first-class in the design snapshot.
- Snapshot restore recreates the virtual containers and remaps shared override rows.
- Publication materializes shared entities into ordinary runtime metadata before application sync.
- Applications keep runtime tables flat even when design-time authoring stays shared.

## Related Reading

- [Metahubs](../platform/metahubs.md)
- [Resources Workspace](../platform/metahubs/common-section.md)
- [Shared Entity Overrides](../api-reference/shared-entity-overrides.md)
