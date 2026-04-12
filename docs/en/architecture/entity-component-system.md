---
description: Entity-Component-Action-Event architecture for custom metahub entity types.
---

# Entity Component System

The Entity-Component-Action-Event (ECAE) layer adds custom metahub entity types without replacing the legacy Catalogs, Sets, or Enumerations surfaces during the current rollout.

## Purpose

- Keep new domain modeling inside one generic entity pipeline.
- Reuse existing metahub authoring services and runtime publication flow.
- Publish entity-based sections such as Hubs V2, Catalogs V2, Sets V2, and Enumerations V2 through metadata instead of hardcoded menus.

## Core Model

1. Entity type definitions describe a kind key, presentation, component manifest, and UI metadata.
2. Components enable capabilities such as data schema, hierarchy, relations, actions, events, layout, and scripting.
3. Actions stay object-owned rows in `_mhb_actions` and represent executable lifecycle behavior.
4. Event bindings stay object-owned rows in `_mhb_event_bindings` and connect events to actions.

## Current Boundaries

- Built-in kinds still keep their dedicated legacy routes and UI entry points.
- Generic entity instance routes currently target custom kinds only.
- Shared services and adapters let custom kinds reuse existing attribute, layout, and publication seams.
- Runtime consumers resolve section-oriented aliases before falling back to legacy catalog naming.

## Builder Flow

1. Create a type from the Entities workspace or from a reusable preset.
2. Enable only the components that are already genericized or adapter-backed.
3. Save the type and author instances from the generated custom-kind surface.
4. Mark the type as published when it should appear in the dynamic menu zone.
5. Publish the metahub and sync the linked application before checking runtime.

## Coexistence Rules

- Legacy Hubs, Catalogs, Sets, and Enumerations remain visible until parity is accepted.
- Hubs V2, Catalogs V2, Sets V2, and Enumerations V2 reuse the matching legacy authoring primitives instead of a second policy layer.
- Browser validation must cover design-time workspace flows, legacy/V2 coexistence, and the publication/runtime path.
- Only catalog-compatible sections materialize in runtime navigation; hub/set/enumeration-compatible kinds stay filtered after publication sync.

## Related Packages

- `@universo/metahubs-backend` owns entity definitions, actions, event bindings, and publication metadata.
- `@universo/metahubs-frontend` owns the Entities workspace and custom entity instance authoring.
- `@universo/applications-backend` and `@universo/applications-frontend` consume published sections at runtime.