---
description: Metahub template that bundles the new Projects entity type with the base presets for PlayCanvas-driven games.
---

# PlayCanvas Metahub Template

`PlayCanvas` is an opt-in metahub template that includes the new `Projects` entity type together with the base presets. It is the recommended starting point for metahubs that author content through the PlayCanvas Editor and runtime.

This template is not selected by default. New metahubs still start from `Basic` unless a user explicitly chooses `PlayCanvas`.

## Preset Catalog

The template bundles the following presets:

| Preset             | Role                                              |
| ------------------ | ------------------------------------------------- |
| `project`          | Anchors each PlayCanvas Editor project 1:1       |
| `hub`              | Top-level hierarchy (unchanged)                   |
| `page`             | Structured block content (unchanged)              |
| `object`           | Records/components (unchanged)                    |
| `set`              | Typed constants (unchanged)                       |
| `enumeration`      | Closed value lists (unchanged)                    |

The `Projects` section is placed above `Hubs` in the left menu via `sidebarOrder: 5`.

## What the Template Does Not Declare

The template does **not** declare metahub package attachments. Connecting `@universo-react/playcanvas-editor-frontend`, `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`, and `@universo-react/colyseus-server` is a runtime step on the metahub (the Resources → Packages panel), exactly as today. This keeps the template manifest simple (only `presets` + `seed`) and avoids coupling template versioning to the package catalog.

## Worked Example

The MMOOMM (Universo MMO) generator bootstraps a metahub from the `PlayCanvas` template, then authors:

1. A `Projects` instance named `MMOOMM Authoring`.
2. A `Project` record created and bound to that instance (`config.projectBinding`).
3. Flight, ship, station, movement commands, and simulation constants under the standard object / set / enumeration presets.
4. Runtime modules (flight canvas widget, fixed-tick flight runtime) and a published application.

The generated snapshot is committed at `tools/fixtures/metahubs-mmoomm-app-snapshot.json`.

## Related

-   [Projects Entity Type](./projects-entity-type.md)
-   [PlayCanvas Projects](./playcanvas-projects.md)
-   [PlayCanvas Editor](./playcanvas-editor.md)
