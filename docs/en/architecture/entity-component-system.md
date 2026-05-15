---
description: Entity-Component-Action-Event architecture for custom metahub entity types.
---

# Entity Component System

The Entity-Component-Action-Event (ECAE) layer adds custom and standard metahub entity types through one entity-owned route model backed by shared authoring surfaces.

## Purpose

- Keep new domain modeling inside one generic entity pipeline.
- Reuse existing metahub authoring services and runtime publication flow.
- Publish entity-based sections such as Hubs, Objects, Sets, and Enumerations through metadata instead of hardcoded menus.

## Core Model

1. Entity type definitions describe a kind key, presentation, component manifest, and UI metadata.
2. Components enable capabilities such as data schema, hierarchy, relations, actions, events, layout, and scripting.
3. Actions stay object-owned rows in `_mhb_actions` and represent executable lifecycle behavior.
4. Event bindings stay object-owned rows in `_mhb_event_bindings` and connect events to actions.

## Resource Surfaces

- Shared Resources tabs are defined by `ui.resourceSurfaces` on persisted entity type rows.
- The user-visible tab title comes from `ui.resourceSurfaces[].title` in VLC format.
- `titleKey` is a compatibility fallback only; new standard presets store localized titles directly in entity metadata.
- Standard rows are never synthesized by services when `_mhb_entity_type_definitions` is missing data. Missing metadata fails closed.
- Publication snapshots preserve `entityTypeDefinitions`, and the canonical publication hash includes this metadata.
- Application executable schema generation still uses structural `snapshot.entities`, so label-only resource surface edits do not create DDL changes.

## Current Boundaries

- Generic entity instance routes still focus on true custom kinds.
- Standard metadata kinds enter through entity-owned routes and reuse the matching authoring surfaces underneath.
- Shared services and adapters let custom kinds reuse existing component, layout, and publication seams.
- Runtime consumers resolve section-oriented aliases from published entity metadata before falling back to older naming aliases.

## Builder Flow

1. Create a type from the Entities workspace or from a reusable preset.
2. Enable only the components that are already genericized or adapter-backed.
3. Save the type and author instances from the generated entity-owned surface.
4. Mark the type as published when it should appear in the dynamic menu zone.
5. Publish the metahub and sync the linked application before checking runtime.

## Route Ownership Rules

- Standard Hubs, Objects, Sets, and Enumerations are published through direct standard kind keys.
- Entity-owned routes reuse the matching authoring primitives instead of introducing a second CRUD shell.
- Browser validation must cover design-time workspace flows, entity-owned standard routes, and the publication/runtime path.
- Runtime navigation materializes the sections described by the published entity metadata and current runtime adapters.

## Related Packages

- `@universo/metahubs-backend` owns entity definitions, actions, event bindings, and publication metadata.
- `@universo/metahubs-frontend` owns the Entities workspace and custom entity instance authoring.
- `@universo/applications-backend` and `@universo/applications-frontend` consume published sections at runtime.
