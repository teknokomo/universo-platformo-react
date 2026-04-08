---
description: Platform-reference overview of metahub scripting surfaces, scopes, and delivery flow.
---

# Metahub Scripts

Metahub scripts are the design-time scripting surface owned by a metahub before publication turns consumer scripts into runtime entries.
The same scripting contract spans Common libraries, metahub-level logic, and object-attached consumers.

## Surfaces

- Common -> Scripts authors import-only `general/library` helpers.
- Metahub-level scripts author reusable runtime logic that is not tied to one object.
- Object-attached scripts keep behavior close to a hub, catalog, set, enumeration, or attribute.
- Publications package active consumer scripts for application sync and runtime execution.

## Delivery Rules

- Keep shared helper code in Common libraries and import it through `@shared/<codename>`.
- Keep executable consumers on metahub or object scopes so runtime attachment stays explicit.
- Publish and sync before checking browser or runtime behavior.
- Treat backend validation errors as contract failures, not as optional warnings.

## Related Reading

- [Shared Scripts](shared-scripts.md)
- [Script Scopes](script-scopes.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)