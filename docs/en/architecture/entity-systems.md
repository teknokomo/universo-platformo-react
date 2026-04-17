---
description: Architecture overview of the entity-first system.
---

# Entity Systems Architecture

The entity system provides a unified model for all structured data within a metahub. Every piece of content—whether it is a tree entity (hub), linked collection (catalog), value group (set), or option list (enumeration)—is represented as an **entity instance** that belongs to an **entity type**.

## Core Concepts

### Entity Types

Entity types define the shape and behavior of instances. There are two categories:

- **Standard kinds**: Built-in kinds seeded by template presets. These include `hub`, `catalog`, `set`, and `enumeration`. Each standard kind has specialized UI and backend behavior registered through the behavior service registry.
- **Custom entity types**: User-defined types created through the entity type management UI. Custom types use the generic entity instance CRUD and can have custom component manifests.

### Behavior Service Registry

The behavior registry maps kind keys to specialized services and UI components. When an entity instance is loaded, the system looks up its kind key and delegates to the appropriate:
- Backend controller handlers (CRUD, reorder, copy, delete with blocking references)
- Frontend list components (TreeEntityList, LinkedCollectionList, ValueGroupList, OptionListList)
- Delete dialogs (TreeDeleteDialog, BlockingEntitiesDeleteDialog)

### Template Presets

Templates define which standard kinds are available when creating a metahub. Each preset can be toggled on/off during creation. When a preset is enabled:
1. An entity type row is created for that standard kind
2. A default instance is seeded with a localized name
3. Child metadata structures are initialized (field definitions, fixed values, etc.)

### Child Resources (Metadata)

Entity instances can own child metadata:
- **Field definitions**: Schema fields that define the structure of records (formerly "attributes")
- **Fixed values**: Predefined values within a value group (formerly "constants")
- **Records**: Data entries within a linked collection (formerly "elements")
- **Option values**: Selectable values within an option list (formerly "enumeration values")

## Route Structure

All entity operations go through entity-owned routes:
- `/entities/:kindKey/instance/:instanceId` — instance detail
- `/entities/:kindKey/instance/:instanceId/field-definitions` — field definitions tab
- `/entities/:kindKey/instance/:instanceId/fixed-values` — fixed values tab
- `/entities/:kindKey/instance/:instanceId/records` — records tab

## Standard Kind Mapping

| Kind Key | Display Name | Container | Child Metadata |
|----------|-------------|-----------|----------------|
| `hub` | Tree Entity | — (top-level tree) | Linked collections |
| `catalog` | Linked Collection | Tree Entity | Field definitions, Records |
| `set` | Value Group | — (standalone) | Fixed values |
| `enumeration` | Option List | — (standalone) | Option values |

## Related Reading

- [Frontend Architecture](frontend.md)
- [Backend Architecture](backend.md)
- [Custom Entity Types Guide](../guides/custom-entity-types.md)
- [Metahub Schema](metahub-schema.md)
