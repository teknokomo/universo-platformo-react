---
description: Explain what metahubs own, how the resources workspace and settings layers work, and how publications feed applications.
---

# Metahubs

Metahubs are the design-time source of truth for structures, resources-workspace assets, scripts, and publication-ready content.
They are not just folders: each metahub owns the authoring model that later becomes publication data and application runtime state.

## What A Metahub Owns

- branches for design-time evolution;
- entity types, entity instances, field definitions, fixed values, records, and other authoring resources;
- the dedicated resources workspace, including shared layouts, reusable metadata pools, and reusable scripts;
- scripts attached at resources, metahub, or entity scope;
- publications that package the current approved state.

## Main Authoring Surfaces

| Surface | Purpose |
| --- | --- |
| Resources | Author shared layouts, reusable metadata resources, and reusable scripts from one dedicated surface. |
| Entities | Author platform-provided standard kinds and custom kinds from the unified entity workspace. |
| Branches | Separate design-time timelines and controlled activation. |
| Publications | Freeze a version that can be delivered to applications. |
| Members | Control who can author and manage the metahub. |

## Settings Layers Around Metahubs

Metahub behavior is controlled by more than one settings layer, and the layers are intentionally separated.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub dialog settings | Metahub settings storage | Authoring dialog size, fullscreen, resize, and close behavior for metahub-scoped dialogs. |
| Shared layout behavior | Selected shared layout config | Default runtime view settings and create/edit/copy behavior before an entity gets its first layout override. |
| Entity layout behavior | Selected entity layout config | `showCreateButton`, `searchMode`, and create/edit/copy behavior for the chosen entity layout. |
| Application settings | Application record | Application control-panel dialogs only, not metahub authoring dialogs. |

## Resources Workspace Scope

The cross-cutting authoring entrypoint now lives on the dedicated resources workspace under `/resources`.
Shared layouts stay centralized, reusable metadata pools stay reusable, and resources scripts keep the shared `@shared/<codename>` import contract.
This keeps metahub authoring separate from admin dialogs and from application-control-panel dialogs.

![Resources workspace](../.gitbook/assets/entities/resources-workspace.png)

## How Metahubs Feed Runtime

1. Author the structure, shared layouts, reusable metadata resources, and scripts in the metahub.
2. Publish a version when the design-time state is ready.
3. Link or update an application from that publication.
4. Let application sync materialize the flattened runtime layouts, widgets, and scripts into application tables.
5. Open the published runtime on `/a/:applicationId`.

## Scripts And Layouts Together

The quiz flow is a good example of why metahubs stay the source of truth.
The shared library helper is authored in Resources, the widget consumer script is authored at metahub scope, the widget placement is configured in the shared layout model, and the resulting publication carries all three pieces into the linked application.
Until an entity gets its first layout override, runtime behavior comes from the selected shared layout; after that, the selected entity layout owns the runtime create/edit/copy behavior.

## Practical Reading Order

1. Read [Metahub Scripting](../guides/metahub-scripting.md) for the script contract.
2. Read [Quiz Application Tutorial](../guides/quiz-application-tutorial.md) for the browser-authored quiz example.
3. Read [Applications](applications.md) for the control-panel and runtime side of the delivery flow.
