# System Patterns

## UPDL Node Patterns and Visual Programming

### Key Design Principles

1. **Universal Description Layer**

    - UPDL nodes describe "what" should happen, not "how"
    - Technical implementation details are hidden from the developer
    - The same node graph works across different platforms

2. **Hierarchical Structure**

    - Space node serves as the root container (formerly Scene)
    - Objects can contain other objects (parent-child relationship)
    - Cameras and lights can be attached to objects or directly to space

3. **Typed Ports and Connections**
    - Each port has a specific data type
    - Connections are validated for type compatibility
    - The editor prevents incompatible connections

### Connector Implementation Guide ✅ **COMPLETE**

**Key Principles for UPDL node connectors:**

1. **Input Connectors**: Define in parent node's `inputs` array with matching `type` property
2. **Output Connectors**: Use empty `outputs: []` for default Flowise behavior
3. **Type Safety**: Centralize connector types in `CONNECTABLE_TYPES` constant
4. **Terminal Nodes**: Use empty arrays for self-contained nodes (e.g., ActionNode)

**Connection Structure:**

-   **Entity** accepts: Components, Events
-   **Event** accepts: Actions
-   **Space** accepts: Entities, Universo, legacy nodes
-   **Universo** connects to Space for global context

### Template-Specific Implementation Patterns

#### PlayCanvas MMOOMM Template Patterns

**Physics Fallback Pattern:**

```typescript
// Graceful degradation from physics to direct movement
if (!entity.rigidbody.body) {
    this.moveDirectly(direction) // Fallback method
}
```

### Common UPDL Patterns

**High-Level Node Patterns:**

-   **Space** → **Entity** → **Component** (modern approach)
-   **Space** → **Object** → **Animation** → **Interaction** (legacy support)
-   **Multi-Space**: Connected spaces for complex experiences

**Export Features:**

-   Automatic addition of missing required elements (camera, lighting)
-   Platform-specific transformations and optimizations
-   Technology-specific parameter handling

**Rendering Patterns:**

-   **Iframe-based Rendering**: Isolated script execution for proper library loading and security
-   **Template System**: Reusable export templates across multiple technologies
-   **Static Library Integration**: CDN and local library sources with fallback support

## APPs Architecture Pattern (v0.21.0-alpha)

**6 Working Applications** with modular architecture:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages

### Key Benefits

-   **Separation of Concerns**: Core Flowise unchanged, functionality isolated in apps
-   **Template-First Architecture**: Reusable export templates across technologies
-   **Interface Separation**: Core UPDL vs simplified integration interfaces
-   **Easy Extension**: New technologies and node types added modularly

## UPDL Node System ✅ **COMPLETE**

**High-Level Abstract Nodes** (v0.21.0-alpha):

### 7 Core Node Types

-   **Space**: Root container for 3D environments
-   **Entity**: Game objects with transform and behavior
-   **Component**: Attachable behaviors (geometry, material, script)
-   **Event**: Trigger system for interactions
-   **Action**: Executable behaviors and responses
-   **Data**: Information storage and quiz functionality
-   **Universo**: Global connectivity and network features

### Architecture Features

-   **Universal Description**: Platform-independent intermediate representation
-   **Template-Based Export**: Multi-technology support (AR.js, PlayCanvas)
-   **Hierarchical Structure**: Parent-child relationships with typed connections
-   **Version Compatibility**: Forward/backward compatibility via `updlVersion`

## Development Principles

### Architecture Patterns

**Editor-Format-Export-Deploy**: Flowise UI → UPDL JSON → Template System → Published Applications

**Modular Communication**: Clear interfaces via UPDL JSON, platform abstraction through unified exporters

### Code Standards

-   **Documentation**: Prefix comments with "Universo Platformo |", concise English documentation
-   **Localization**: Modular i18n with namespace separation (`apps/<app>/i18n/`)
-   **Workspace Packages**: Scoped packages (`@universo/package-name`) for backend services

### Future-Ready Design

-   Workspace packages extractable to separate repositories
-   Microservices architecture evolution support
-   Easy addition of new technologies and node types

---

_For detailed application structure and development guidelines, see [apps/README.md](../apps/README.md). For technical implementation details, see [techContext.md](techContext.md). For project overview, see [projectbrief.md](projectbrief.md)._
