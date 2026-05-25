---
description: Platform reference for shared library modules authored from the Resources workspace and their fail-closed delivery rules.
---

# Shared Modules

Shared modules are the Resources-workspace library modules that publish reusable helpers for other metahub modules.
They are import-only design assets and are not exposed as direct runtime entrypoints.

![Shared module authoring surface in the metahub modules dialog](../../.gitbook/assets/quiz-tutorial/metahub-modules.png)

## Authoring Rules

- Create shared modules only from the Modules tab in the Resources workspace.
- Pair `attachedToKind=general` with `moduleRole=library` every time.
- Keep library code pure and move executable behavior into consumer modules.
- Import shared helpers from consumers through `@shared/<codename>`.

## Fail-Closed Rules

- General modules reject non-library roles.
- New library modules reject non-general attachment scopes.
- Delete and codename rename fail while dependent consumers still import the library.
- Circular `@shared/*` graphs fail before publication can ship runtime state.

## Publication And Runtime

Publication validates shared libraries in dependency order before compiling consumer modules.
Runtime keeps shared-library logic reachable only through compiled consumers instead of listing library rows as executable runtime modules.

## Related Reading

- [Metahub Modules](modules.md)
- [Module Scopes](module-scopes.md)
- [Metahub Modules Guide](../../guides/metahub-modules.md)
- [Modules System](../../architecture/modules-system.md)
