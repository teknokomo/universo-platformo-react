---
description: Platform reference for the Common section and its standalone tabs in metahub authoring.
---

# Common Section

The Common section is the metahub-level surface for authoring resources that must stay reusable across multiple target objects.
It is separate from target-object CRUD because it owns the shared design contract before publication flattens that contract into runtime state.

## Tabs

- Layouts: global layouts and catalog-specific layout overlays.
- Attributes: shared catalog attributes inherited by catalog objects.
- Constants: shared set constants inherited by sets.
- Values: shared enumeration values inherited by enumeration objects.
- Scripts: Common/general library scripts imported through `@shared/<codename>`.

## Operator Rules

- Open Common when the resource should be shared first and overridden only sparsely per target.
- Open a target catalog, set, or enumeration when you need to inspect the merged inherited result.
- Keep per-target exclusions and active-state changes sparse instead of cloning shared rows.
- Publish and sync the linked application to verify the runtime materialization of the Common resource.

## Runtime Outcome

Shared rows stay ordinary design-time rows inside their virtual Common pools, but publication materializes them into ordinary runtime metadata for the linked application.
This keeps authoring reusable while keeping runtime tables flat and predictable.

## Related Reading

- [Shared Attributes](shared-attributes.md)
- [Shared Constants](shared-constants.md)
- [Shared Values](shared-values.md)
- [Shared Scripts](shared-scripts.md)
- [Metahubs](../metahubs.md)