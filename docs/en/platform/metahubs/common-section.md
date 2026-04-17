---
description: Platform reference for the resources workspace and its reusable tabs in metahub authoring.
---

# Resources Workspace

The Resources workspace is the metahub-level surface for authoring assets that must stay reusable across multiple target objects.
It is separate from target-object CRUD because it owns the shared design contract before publication flattens that contract into runtime state.

## Tabs

- Layouts: shared layouts and entity-specific layout overrides.
- Field Definitions: shared field-definition pools reused by compatible entity types.
- Fixed Values: shared fixed-value pools reused by compatible entity types.
- Option Values: shared option-value pools reused by compatible entity types.
- Scripts: resources-scoped library scripts imported through `@shared/<codename>`.

## Operator Rules

- Open Resources when the asset should be shared first and overridden only sparsely per target.
- Open a target entity when you need to inspect the merged inherited result.
- Keep per-target exclusions and active-state changes sparse instead of cloning shared rows.
- Publish and sync the linked application to verify the runtime materialization of the shared asset.

## Runtime Outcome

Shared rows stay ordinary design-time rows inside their reusable resource pools, but publication materializes them into ordinary runtime metadata for the linked application.
This keeps authoring reusable while keeping runtime tables flat and predictable.

## Related Reading

- [Shared Field Definitions](shared-field-definitions.md)
- [Shared Fixed Values](shared-fixed-values.md)
- [Shared Option Values](shared-option-values.md)
- [Shared Scripts](shared-scripts.md)
- [Metahubs](../metahubs.md)