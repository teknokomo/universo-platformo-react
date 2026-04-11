---
description: Practical guide for creating and publishing custom entity types.
---

# Custom Entity Types

Custom entity types let a metahub define new authoring and runtime sections on top of the shared entity pipeline instead of adding a one-off built-in object.

## When To Use Them

- Use a custom entity type when the object is metahub-specific and should not become a new fixed platform module.
- Use a reusable preset when the shape should stay consistent across metahubs.
- Keep built-in Catalogs, Sets, and Enumerations for the legacy surfaces that are still authoritative during coexistence.

## Typical Flow

1. Open the Entities workspace below Common.
2. Start from a preset such as Catalogs v2 or from an empty type.
3. Fill the kind key, codename, name, and tab configuration.
4. Enable only the components that match the intended behavior.
5. Save the type, open its instances page, and create the first instance before opening automation tabs.
6. Use the edit dialog to configure Scripts, then Actions, then Events for the saved instance.
7. Mark the type as published only when it should become a runtime section.

## Current Component Set

- Data schema, predefined elements, hub assignment, constants, and enumeration values cover the current metadata surface.
- Actions and event bindings add object-owned automation hooks.
- Layout, scripting, runtime behavior, and physical table settings extend publication and runtime behavior.
- Component dependencies are validated in the builder, so unsupported combinations should stay disabled.

## Automation Authoring

1. Open a saved instance in edit mode; the Actions and Events tabs stay unavailable before the first save.
2. In the Scripts tab, create or attach the script that should handle the lifecycle behavior.
3. In the Actions tab, create an object-owned action, select the script action type, and link the saved script.
4. In the Events tab, bind a lifecycle event such as beforeCreate, afterCreate, beforeUpdate, or afterUpdate to the action.
5. Use priority and config only when the flow needs ordering or extra payload hints.
6. Re-run the focused browser proof or the direct EntityAutomationTab tests before wider rollout.

## Guardrails

- Prefer presets for parity-heavy flows instead of rebuilding the same manifest by hand.
- Automation authoring on generic custom entity routes follows the manageMetahub contract; catalog-compatible presets reuse the legacy CatalogList surface instead of mounting the generic automation tabs.
- Publishing affects the dynamic menu and runtime only after publication sync or application sync.
- Generic instance routes are for custom kinds; built-in kinds still stay on their legacy routes.
- Advanced visual composition remains out of scope for the current parity wave.

## Visual References

![Create Entity Type dialog](../assets/entities/metahub-entities-create-dialog.png)
![Catalog-compatible general panel](../assets/entities/catalog-compatible-edit-general-panel.png)

## Related References

- See the REST API guide for the generic entity and automation endpoints.
- See the Metahub scripting guide for @OnEvent(...) handlers and script capabilities.

## Validation Checklist

- Confirm the type saves with the expected component manifest.
- Confirm the custom instances page opens from the dynamic menu.
- Confirm publication sync materializes the section in runtime.
- Confirm focused tests or browser flows cover the shipped path before wider rollout.