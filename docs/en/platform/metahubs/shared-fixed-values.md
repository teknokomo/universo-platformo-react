---
description: Platform reference for shared fixed values authored from the Resources workspace.
---

# Shared Fixed Values

Shared fixed values live in the Shared Fixed Values tab of the Resources workspace and belong to the virtual shared value group pool instead of one value group.
They let one fixed value definition stay central while multiple value groups inherit the same design-time source.

## Design-Time Rules

- Create the fixed value from the Shared Fixed Values tab when more than one value group should reuse it.
- Keep shared behavior on the fixed value itself and sparse target changes in override rows.
- Inspect inherited state from the target value group route, but edit the base shared row from the Shared Fixed Values tab.
- Use local value group fixed values only when the value should not spread across value groups.

## Target Controls

- Exclusions remove the inherited fixed value from selected value groups without deleting the shared source.
- Active-state overrides disable the fixed value per value group only when the shared behavior allows it.
- Position overrides reorder the inherited fixed value only when the shared behavior is not locked.
- Target lists keep shared fixed values read-only and display the merged inherited state.

## Publication And Runtime

Publication exports shared fixed values in their own snapshot section.
Runtime keeps fixed values on the existing snapshot constant and setConstantRef path instead of introducing a new runtime table.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Resources Workspace](common-section.md)
- [Metahubs](../metahubs.md)
