---
description: Platform-reference overview of metahub modules surfaces, scopes, and delivery flow.
---

# Metahub Modules

Metahub modules are the design-time modules surface owned by a metahub before publication turns consumer modules into runtime entries.
The same modules contract spans Resources workspace libraries, metahub-level logic, and object-attached consumers.

![Metahub modules dialog with current modules tabs](../../.gitbook/assets/quiz-tutorial/metahub-modules.png)

## Surfaces

- The Modules tab in the Resources workspace authors import-only `general/library` helpers.
- Metahub-level modules author reusable runtime logic that is not tied to one object.
- Object-attached modules keep behavior close to a hub, object, set, enumeration, or component.
- Publications package active consumer modules for application sync and runtime execution.

## Delivery Rules

- Keep shared helper code in Resources workspace libraries and import it through `@shared/<codename>`.
- Keep executable consumers on metahub or object scopes so runtime attachment stays explicit.
- Publish and sync before checking browser or runtime behavior.
- Treat backend validation errors as contract failures, not as optional warnings.

## Related Reading

- [Shared Modules](shared-modules.md)
- [Module Scopes](module-scopes.md)
- [Metahub Modules Guide](../../guides/metahub-modules.md)
- [Modules System](../../architecture/modules-system.md)
