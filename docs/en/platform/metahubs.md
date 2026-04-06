---
description: Explain what metahubs own, how their settings layers work, and how they feed publications and applications.
---

# Metahubs

Metahubs are the design-time source of truth for structures, layouts, scripts, and publication-ready content.
They are not just folders: each metahub owns the authoring model that later becomes publication data and application runtime state.

## What A Metahub Owns

- branches for design-time evolution;
- catalogs, hubs, sets, enumerations, attributes, and other authoring entities;
- layouts and dashboard composition;
- scripts attached at metahub or entity scope;
- publications that package the current approved state.

## Main Authoring Surfaces

| Surface | Purpose |
| --- | --- |
| Branches | Separate design-time timelines and controlled activation. |
| Layouts | Configure runtime layout zones, widgets, and view settings. |
| Scripts | Author embedded runtime modules, lifecycle handlers, and widget code. |
| Publications | Freeze a version that can be delivered to applications. |
| Members | Control who can author and manage the metahub. |

## Settings Layers Around Metahubs

Metahub behavior is controlled by more than one settings layer, and the layers are intentionally separated.

| Layer | Stored at | Affects |
| --- | --- | --- |
| Metahub common settings | Metahub settings storage | Authoring dialog size, fullscreen, resize, and close behavior for metahub-scoped dialogs. |
| Catalog and runtime settings | Metahub entity config | Runtime columns, layout behavior, and catalog-level view behavior. |
| Admin platform policy | Admin settings storage | Whether platform `_upl_*` system attributes are exposed or forced by policy. |
| Application settings | Application record | Application control-panel dialogs only, not metahub authoring dialogs. |

## Dialog Presentation Scope

Metahub dialog settings remain scoped to metahub authoring routes such as `/metahub/:metahubId/...`.
They do not override admin dialogs and they do not override application-control-panel dialogs.
This separation lets one team keep compact metahub authoring dialogs while another application uses larger control-panel windows.

## How Metahubs Feed Runtime

1. Author the structure, layout, and scripts in the metahub.
2. Publish a version when the design-time state is ready.
3. Link or update an application from that publication.
4. Let application sync materialize the publication into runtime tables and runtime scripts.
5. Open the published runtime on `/a/:applicationId`.

## Scripts And Layouts Together

The quiz flow is a good example of why metahubs stay the source of truth.
The widget script is authored in the metahub, the widget placement is configured in the metahub layout, and the resulting publication carries both pieces into the linked application.
If you change only the application control-panel settings, you change the admin experience of that application, not the metahub-owned quiz behavior itself.

## Practical Reading Order

1. Read [Metahub Scripting](../guides/metahub-scripting.md) for the script contract.
2. Read [Quiz Application Tutorial](../guides/quiz-application-tutorial.md) for the browser-authored quiz example.
3. Read [Applications](applications.md) for the control-panel and runtime side of the delivery flow.
