---
description: Platform reference for shared option values authored from the Resources workspace.
---

# Shared Option Values

Shared option values live in the Common Option Values tab and belong to the virtual shared option list pool instead of one option list.
They let one option value definition stay reusable while multiple option lists inherit the same source row.

## Design-Time Rules

- Create the option value from Common when the same meaning must appear in more than one option list.
- Keep shared behavior on the shared row and sparse target changes in override rows.
- Use target option lists to inspect inherited state, but keep the base shared authoring flow in Common.
- Use local option list values only when one option list needs a value that others must not inherit.

## Target Controls

- Exclusions hide the inherited option value from selected option lists without deleting the shared source.
- Active-state overrides disable the inherited option value only when the shared behavior allows deactivation.
- Position overrides reorder the inherited option value only when the shared behavior is not locked.
- Target lists keep shared option values read-only and display the merged inherited result.

## Publication And Runtime

Publication exports shared option values in their own snapshot section.
Runtime normalizes duplicated inherited option value ids per target option list so runtime metadata and seeded refs stay deterministic.

## Related Reading

- [Exclusions](exclusions.md)
- [Shared Behavior Settings](shared-behavior-settings.md)
- [Resources Workspace](common-section.md)
- [Metahubs](../metahubs.md)
