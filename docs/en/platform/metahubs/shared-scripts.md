---
description: Platform reference for shared library scripts authored from the Resources workspace and their fail-closed delivery rules.
---

# Shared Scripts

Shared scripts are the Resources-workspace library modules that publish reusable helpers for other metahub scripts.
They are import-only design assets and are not exposed as direct runtime entrypoints.

![Shared script authoring surface in the metahub scripts dialog](../../.gitbook/assets/quiz-tutorial/metahub-scripts.png)

## Authoring Rules

- Create shared scripts only from the Scripts tab in the Resources workspace.
- Pair `attachedToKind=general` with `moduleRole=library` every time.
- Keep library code pure and move executable behavior into consumer scripts.
- Import shared helpers from consumers through `@shared/<codename>`.

## Fail-Closed Rules

- General scripts reject non-library roles.
- New library scripts reject non-general attachment scopes.
- Delete and codename rename fail while dependent consumers still import the library.
- Circular `@shared/*` graphs fail before publication can ship runtime state.

## Publication And Runtime

Publication validates shared libraries in dependency order before compiling consumer scripts.
Runtime keeps shared-library logic reachable only through compiled consumers instead of listing library rows as executable runtime scripts.

## Related Reading

- [Metahub Scripts](scripts.md)
- [Script Scopes](script-scopes.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)
