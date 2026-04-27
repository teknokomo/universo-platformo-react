---
description: Reference for the exact difference between Resources workspace libraries, metahub scripts, and object-attached scripts.
---

# Script Scopes

Metahub scripting uses one manifest contract, but attachment scope decides where a script can live and how it is used.
Choose scope first, then choose the compatible module role and runtime behavior.

![Metahub scripts dialog showing the authoring surface for scopes](../../.gitbook/assets/quiz-tutorial/metahub-scripts.png)

## Scope Matrix

| Scope | Allowed roles | Direct runtime entrypoint | Typical use |
| --- | --- | --- | --- |
| `general` | `library` only | No | Resources workspace shared helpers imported through `@shared/<codename>`. |
| `metahub` | `module`, `lifecycle`, `widget` | Yes | Metahub-level runtime logic and widgets. |
| `hub` / `catalog` / `set` / `enumeration` / `attribute` | `module`, `lifecycle`, `widget` | Yes | Object-attached consumers close to one design surface. |

## Selection Rules

- Choose `general/library` when the code should be reused and imported by other scripts.
- Choose executable scopes when the script must attach to a metahub or one object and participate in runtime delivery.
- Keep decorators and runtime ctx access out of `library` code.
- Publish and sync before validating how the selected consumer behaves in the linked application.

## Related Reading

- [Shared Scripts](shared-scripts.md)
- [Metahub Scripts](scripts.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)
