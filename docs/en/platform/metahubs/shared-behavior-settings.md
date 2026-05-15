---
description: Reference for canDeactivate, canExclude, and positionLocked on shared entities and inherited widgets.
---

# Shared Behavior Settings

Shared behavior settings define which sparse per-target changes are allowed after a row becomes shared.
They keep the base shared design reusable while still letting targets opt into controlled divergence.

![Shared constants list using shared behavior settings](../../.gitbook/assets/entities/shared-constants.png)

## Settings

| Setting | Meaning | Effect |
| --- | --- | --- |
| `canDeactivate` | Targets may disable the inherited row. | `isActive=false` overrides are allowed only when this is true. |
| `canExclude` | Targets may remove the inherited row from their merged view. | Exclusion overrides are allowed only when this is true. |
| `positionLocked` | Targets may not reorder the inherited row. | Sort-order overrides are rejected while this is true. |

## Storage Rules

- Shared components and constants persist `sharedBehavior` in `uiConfig.sharedBehavior`.
- Shared values persist `sharedBehavior` in `presentation.sharedBehavior`.
- Target-specific state still lives in sparse override rows instead of being copied into the base shared row.
- Inherited widgets use the same behavior model through the base widget config and sparse object-widget overrides.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Components](shared-components.md)
- [Shared Constants](shared-fixed-values.md)
- [Shared Values](shared-option-values.md)
