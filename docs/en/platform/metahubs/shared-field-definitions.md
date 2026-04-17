---
description: Platform reference for shared field definitions authored from the Resources workspace.
---

# Shared Field Definitions

Shared field definitions live in the Shared Field Definitions tab of the Resources workspace and belong to the virtual shared linked collection pool instead of one linked collection row.
They let one field definition fan out to multiple linked collections without copying the authoring source.

## Design-Time Rules

- Create the field definition from the Shared Field Definitions tab when it should appear in more than one linked collection.
- Keep field definition behavior in the entity settings and sparse target changes in override rows.
- Use target linked collections only to inspect the merged inherited result, not to edit shared config directly.
- Keep local-only field definitions inside the linked collection route when they should not be inherited.

## Target Controls

- Exclusions hide the shared field definition from selected linked collections without deleting the base row.
- Active-state overrides can disable the field definition per linked collection when the shared behavior allows deactivation.
- Position overrides can reorder the inherited row only when the shared behavior is not locked.
- Target lists keep shared rows read-only and show the merged inherited state.

## Publication And Runtime

Publication keeps shared field definitions as first-class shared sections in the design snapshot.
Application sync materializes them into ordinary runtime field metadata so runtime tables stay flat.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Resources Workspace](common-section.md)
- [Metahubs](../metahubs.md)
