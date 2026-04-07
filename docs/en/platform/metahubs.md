---
description: Explain what metahubs own, how the Common section and settings layers work, and how publications feed applications.
---

# Metahubs

Metahubs are the design-time source of truth for structures, Common-section layouts, scripts, and publication-ready content.
They are not just folders: each metahub owns the authoring model that later becomes publication data and application runtime state.

## What A Metahub Owns

- branches for design-time evolution;
- catalogs, hubs, sets, enumerations, attributes, and other authoring entities;
- the Common section, including global layouts and catalog-specific layout overlays;
- scripts attached at metahub or entity scope;
- publications that package the current approved state.

## Main Authoring Surfaces

| Surface | Purpose |
| --- | --- |
| Common | Author global layouts, catalog-specific layout variants, and shared view behavior from one tabbed surface. |
| Branches | Separate design-time timelines and controlled activation. |
| Scripts | Author embedded runtime modules, lifecycle handlers, and widget code. |
| Publications | Freeze a version that can be delivered to applications. |
| Members | Control who can author and manage the metahub. |

## Settings Layers Around Metahubs

Metahub behavior is controlled by more than one settings layer, and the layers are intentionally separated.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub common settings | Metahub settings storage | Authoring dialog size, fullscreen, resize, and close behavior for metahub-scoped dialogs. |
| Global layout behavior | Selected global layout config | Default catalog runtime view settings and create/edit/copy surface behavior before a catalog gets its first custom layout. |
| Catalog layout behavior | Selected catalog layout config | `showCreateButton`, `searchMode`, and create/edit/copy surface behavior for the chosen catalog layout. |
| Application settings | Application record | Application control-panel dialogs only, not metahub authoring dialogs. |

## Common Section Scope

The real layouts authoring entrypoint now lives under the tabbed Common page, and legacy `/layouts` links redirect there.
Catalog layouts stay sparse: they inherit from a selected global base layout, store only overrides, and can still own catalog-only widgets where needed.
This keeps metahub authoring separate from admin dialogs and from application-control-panel dialogs.

## How Metahubs Feed Runtime

1. Author the structure, Common layouts, and scripts in the metahub.
2. Publish a version when the design-time state is ready.
3. Link or update an application from that publication.
4. Let application sync materialize the flattened runtime layouts, widgets, and scripts into application tables.
5. Open the published runtime on `/a/:applicationId`.

## Scripts And Layouts Together

The quiz flow is a good example of why metahubs stay the source of truth.
The widget script is authored in the metahub, the widget placement is configured in the Common-section layout model, and the resulting publication carries both pieces into the linked application.
Until a catalog gets its first custom layout, runtime behavior comes from the selected global layout; after that, the selected catalog layout owns the runtime create/edit/copy surface behavior.

## Practical Reading Order

1. Read [Metahub Scripting](../guides/metahub-scripting.md) for the script contract.
2. Read [Quiz Application Tutorial](../guides/quiz-application-tutorial.md) for the browser-authored quiz example.
3. Read [Applications](applications.md) for the control-panel and runtime side of the delivery flow.
