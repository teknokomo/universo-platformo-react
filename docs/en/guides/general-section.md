---
description: How to use the metahub General section as the real entrypoint for global layouts and catalog layout navigation.
---

# General Section

The General page is the real authoring entrypoint for layouts in a metahub.
Legacy `/layouts` links still work, but they redirect into General so existing bookmarks do not break.

## What Lives Here

- global layouts that shape shared runtime composition;
- navigation into catalog-specific layout variants;
- shared view behavior that belongs with layout authoring instead of separate admin settings.

## Navigation Contract

1. Open a metahub.
2. Use the sidebar item General.
3. Stay on the Layouts tab to manage global layouts.
4. Open a catalog and continue into its layout list when the catalog needs an override.

## Global Layout Workflow

1. Create or open a global layout from General -> Layouts.
2. Configure zones, widgets, and application view settings.
3. Mark the correct layout as active or default for the global fallback.
4. Use the layout detail view to verify widget placement before publishing.

## Why Layouts Moved

The platform now keeps layout authoring behind one tabbed General surface.
This avoids splitting metahub-level presentation work across separate menu items and keeps future General-level tabs expandable without another navigation refactor.

## Related Reading

- [Catalog Layouts](catalog-layouts.md)
- [Application Template View Settings](app-template-views.md)
- [Metahubs](../platform/metahubs.md)