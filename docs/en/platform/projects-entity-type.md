---
description: First-class metahub entity-type section for managing external authoring projects such as PlayCanvas Editor.
---

# Projects Entity Type

`Projects` is a platform-level entity-type preset that turns an external authoring system into a regular metahub entity-type section. The first supported system is the PlayCanvas Editor; future systems can reuse the same `projectBinding` capability.

A `Projects` instance holds a 1:1 reference to a project in the metahub's own authoring store. It sits above `Hubs` in the left menu and renders through the same shared entity UI as `Objects`, `Pages`, `Sets`, and `Enumerations`.

## How It Is Built

The preset is registered in `builtinEntityTypePresets` exactly like the one-c-compatible presets. Every field is configurable through the Entity Type Constructor:

-   Name and codename (localized)
-   `kindKey` (default `project`)
-   Capabilities (object-like-minimal: `dataSchema` + `records` + `physicalTable`, plus `modules`, `layoutConfig`, `runtimeBehavior`, and the new `projectBinding`)
-   `sidebarSection: 'objects'`, `sidebarOrder: 5` (above `Hubs`)
-   `resourceSurfaces` (the `projectBinding` tab)

No PlayCanvas-specific code is embedded into the shared widget — the binding is a generic capability the constructor exposes.

## Binding to an Authoring Project

Each `Projects` instance carries a `config.projectBinding` reference:

```json
{
    "projectBinding": {
        "provider": "playcanvasEditor",
        "projectCodename": "mmoomm_world",
        "projectId": "0190aaaa-..."
    }
}
```

`projectCodename` is the stable anchor (unique-active codename in the metahub's `_mhb_playcanvas_projects` table). `projectId` is a convenience cache. The backing store stays the source of truth — branches, checkpoints, and version control live inside the PlayCanvas project, never duplicated into the metahub.

The `Projects` section UI exposes three actions on a bound project: **Open editor**, **Publish runtime**, **Unbind**. Creating and binding a new project is a single action (`Create & bind project`) that writes a row to `_mhb_playcanvas_projects` and records the link in the instance `config`.

## Validation and Lifecycle

-   The `config.projectBinding` is validated by the server on every create and update: provider must be supported, `projectCodename` must reference an existing project in the same metahub branch.
-   Deleting a `Projects` instance cascades and soft-deletes the bound PlayCanvas project, so the 1:1 invariant is never broken.
-   The metahub structure version is **not** bumped — the projects store is already part of the current baseline (`_mhb_playcanvas_*` system tables).

## Related

-   [PlayCanvas Metahub Template](./playcanvas-template.md)
-   [PlayCanvas Projects](./playcanvas-projects.md)
-   [PlayCanvas Editor](./playcanvas-editor.md)
