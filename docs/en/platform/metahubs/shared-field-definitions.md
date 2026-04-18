---
description: Platform reference for shared attributes authored from the Resources workspace for catalog-compatible entity types.
---

# Shared Attributes

Shared attributes live in the Attributes tab of the Resources workspace and belong to the virtual shared catalog pool instead of one catalog row.
They let one attribute definition fan out to multiple catalog-compatible entity types without copying the authoring source.

![Shared attributes](../../.gitbook/assets/entities/shared-attributes.png)

## Design-Time Rules

- Create the attribute from the Attributes tab when it should appear in more than one catalog or custom entity type that exposes the same capability.
- Keep attribute behavior in the entity settings and sparse target changes in override rows.
- Use target catalogs only to inspect the merged inherited result, not to edit shared config directly.
- Keep local-only attributes inside the catalog route when they should not be inherited.

## Target Controls

- Exclusions hide the shared attribute from selected target objects without deleting the base row.
- Active-state overrides can disable the attribute per target object when the shared behavior allows deactivation.
- Position overrides can reorder the inherited row only when the shared behavior is not locked.
- Target lists keep shared rows read-only and show the merged inherited state.

## Publication And Runtime

Publication keeps shared attributes as first-class shared sections in the design snapshot.
Application sync materializes them into ordinary runtime field metadata so runtime tables stay flat.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Resources Workspace](common-section.md)
- [Metahubs](../metahubs.md)
