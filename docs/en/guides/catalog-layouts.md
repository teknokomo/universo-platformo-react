description: How catalog-specific layouts inherit from global layouts, store sparse visibility and placement overrides, and control catalog runtime behavior.
---

# Catalog Layouts

Catalog layouts are overlay layouts, not forks.
Each catalog layout points to a global base layout and then adds only the catalog-specific differences.

## Overlay Model

- inherited widgets stay linked to the base global layout;
- catalog-owned widgets live only inside the catalog layout;
- sparse overrides store visibility and placement changes for inherited widgets;
- inherited widget config continues to come from the base layout.

## Creating The First Catalog Layout

1. Open the target metahub.
2. Go to General -> Layouts for the global context, or open the catalog route that leads to its layout list.
3. Create a catalog layout and choose the base global layout.
4. Reorder or toggle inherited widgets as needed, or add catalog-only widgets.

## Runtime Behavior Ownership

The selected catalog layout owns catalog runtime behavior such as:
- create button visibility;
- search mode;
- create, edit, and copy surface type.
Until the first catalog layout exists, runtime keeps using the catalog fallback runtime settings.

## Publication And Runtime

Publication flattens the effective catalog layout into ordinary runtime layout and widget rows.
Applications do not resolve overlay logic on the fly; they consume the already materialized runtime state.
Inherited widgets keep their base config during materialization; overlay rows only affect placement and active state.

## Related Reading

- [General Section](general-section.md)
- [Metahubs](../platform/metahubs.md)
- [Applications](../platform/applications.md)