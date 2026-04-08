---
description: Platform reference for shared set constants authored from the Common section.
---

# Shared Constants

Shared constants live in the Common Constants tab and belong to the virtual shared set pool instead of one set.
They let one constant definition stay central while multiple sets inherit the same design-time source.

## Design-Time Rules

- Create the constant from Common when more than one set should reuse it.
- Keep shared behavior on the constant itself and sparse target changes in override rows.
- Inspect inherited state from the target set route, but edit the base shared row from Common.
- Use local set constants only when the value should not spread across sets.

## Target Controls

- Exclusions remove the inherited constant from selected sets without deleting the shared source.
- Active-state overrides disable the constant per set only when the shared behavior allows it.
- Position overrides reorder the inherited constant only when the shared behavior is not locked.
- Target lists keep shared constants read-only and display the merged inherited state.

## Publication And Runtime

Publication exports shared constants in their own snapshot section.
Runtime keeps constants on the existing snapshot constant and setConstantRef path instead of introducing a new runtime table.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Common Section](common-section.md)
- [Metahubs](../metahubs.md)