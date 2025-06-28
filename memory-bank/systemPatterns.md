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

### Common Node Patterns

#### Basic AR Space Pattern

```
Space (root element)
├── Camera (camera settings)
├── Light (scene lighting)
└── AR Marker (marker definition)
    └── Object (3D model or primitive)
        └── Animation (object rotation)
            └── Interaction (click handling)
```

#### Interactive 3D Space Pattern

```
Space (root element)
├── Camera (camera settings)
│   └── Controller (orbital control)
├── Light (primary lighting)
├── AmbientLight (background lighting)
└── Object (scene container)
    ├── Model (3D model)
    │   └── Interaction (click handling)
    │       └── Animation (interaction response)
    └── Data (quiz functionality)
```

#### Multi-Space Pattern

```
Space 1 (initial space)
├── [Standard elements]
└── Interaction (transition)
    └── Space 2 (next space)
        └── [Standard elements]
```

### Default Value Handling

1. **Adding Required Elements**

    - Missing camera automatically added with default parameters
    - Basic lighting added if no light nodes present
    - AR marker auto-added in AR mode if not specified

2. **Platform-Specific Transformations**

    - Coordinate system conversions between different engines
    - Material adaptations based on engine capabilities
    - Mobile optimizations for AR mode

3. **Special Parameter Sections**
    - Technology-specific parameter sections in each node
    - Only relevant parameters applied during export
    - Reasonable defaults for missing parameters

## APPs Architecture Pattern

The project follows a modular APPs architecture that separates concerns while minimizing changes to the core Flowise codebase.

### Current Implementation Status (v0.17.0+)

**6 Working Applications:**

-   **UPDL** (`apps/updl/`) - Pure node definitions for Flowise editor with Space, Object, Camera, Light, Data nodes
-   **Publish Frontend/Backend** (`apps/publish-frt/`, `apps/publish-srv/`) - AR.js publication system with iframe rendering
-   **Analytics** (`apps/analytics-frt/`) - Quiz analytics and performance tracking
-   **Profile Frontend** (`apps/profile-frt/`) - User profile management with i18n
-   **Profile Backend** (`@universo/profile-srv`) - Workspace package backend service

**Detailed Directory Structure:** See [apps/README.md](../apps/README.md) for complete architecture documentation and current application structure.

### Interface Architecture (Two-Layer System)

**UPDL Core Interfaces** (`apps/updl/base/src/interfaces/UPDLInterfaces.ts`):

-   Complete UPDL ecosystem definitions for flows, graphs, and detailed node properties
-   Full specification with advanced properties (materials, physics, animations)
-   Used internally by UPDL nodes and graph processing

**Integration Interfaces** (`packages/server/src/Interface.UPDL.ts`):

-   Simplified interfaces for backend/frontend integration
-   Essential properties for space processing and publication
-   Available via `@server/interface` alias

**Benefits:**

-   **Clean Separation**: Each interface serves distinct purpose
-   **Future-Proof**: Core UPDL can evolve independently
-   **Performance**: Smaller footprint for production
-   **No Duplication**: Intentional architectural separation

### Key Architectural Benefits

1. **Separation of Concerns**

    - Core functionality remains in original packages
    - UPDL node system contained in apps/updl with quiz support via Data nodes
    - Publication system isolated in apps/publish-frt and apps/publish-srv
    - Analytics functionality separated in apps/analytics-frt
    - Profile management via workspace package pattern

2. **Minimal Core Changes**

    - Original Flowise codebase remains largely untouched
    - Integration points well-defined and limited through aliases
    - Backward compatibility maintained across all applications

3. **Easy Extension**

    - New export technologies added as builders in publish-frt
    - Consistent API across all exporters via publish-srv
    - Simple addition of new node types in apps/updl
    - Modular application structure for new functionality

4. **Clean Publication Flow**

    - Unified URL format: `/p/{uuid}`
    - Iframe-based AR.js rendering for proper script execution
    - Streaming generation from UPDL nodes to target platforms
    - Local library serving for CDN-blocked regions

5. **Proven Architecture Pattern**
    - 6 applications successfully implemented and working (v0.17.0+)
    - TypeScript + JSX integration with `allowJs: true` pattern
    - Consistent build process across all applications
    - Modular i18n with namespace separation
    - Workspace package pattern for backend services

## UPDL Node System

UPDL represents a project as a **graph of nodes** and connections. Key UPDL node types:

### Core Node Types

-   **Space:** Root node representing a separate space or screen (formerly Scene)
-   **Object:** General-purpose scene entity with transform, primitive/model, and material properties
-   **Camera:** Viewpoint definition with perspective/orthographic modes and AR/VR settings
-   **Light:** Lighting nodes (Directional, Point, Spot, Ambient) with color, intensity, and type-specific settings
-   **Data:** Quiz functionality with questions, answers, scoring, and lead collection
-   **Interaction:** Event-generating nodes (OnClick, OnKeyPress, OnCollision, OnMarkerFound, OnTimer)
-   **Controller:** Behavior components (OrbitControls, FirstPersonController, SpinController)
-   **Animation:** Time-based property changes with keyframe or procedural animations

### Node Architecture Features

**Hierarchical Structure:**

-   Nodes can contain child nodes forming a tree for spatial structure
-   Logical connections via input/output ports for events/data flow
-   Standard JSON schema for easy save/load with version compatibility

**Extensibility:**

-   Forward-compatibility principles for adding new node types
-   Older parsers ignore unfamiliar nodes
-   Version management via `updlVersion` field

## Code Documentation Guidelines

-   Prefix first comment line with "Universo Platformo | "
-   Write concise English comments for new code and changes
-   Document API contracts and integration points clearly

## Common Architecture Principles

### Editor-Format-Export-Deploy Pattern

1. **Editor (Flowise UI):** Visual interface for creating UPDL node graphs
2. **UPDL Format (JSON):** Platform-independent intermediate representation
3. **Export Module:** Technology-specific code generators (AR.js, PlayCanvas, Babylon.js, etc.)
4. **Publishing System:** Infrastructure for deploying generated applications

### Modular Communication

-   **UPDL Core Module** (`apps/updl`) handles node definitions and graph processing
-   **Publishing Module** (`apps/publish`) manages deployment and URL generation
-   **Clear interfaces** via UPDL JSON as main contract between components
-   **Platform abstraction** through unified exporter interface

## Localization System Architecture

### Current i18n Implementation

**Main Configuration:** `packages/ui/src/i18n/index.js` with transition to modular namespaces

**APPs Integration Pattern:**

```
apps/<app-name>/base/i18n/
├── locales/
│   ├── en/main.json
│   └── ru/main.json
└── index.js (optional exports)
```

**Usage in Components:**

```jsx
const { t } = useTranslation('updl')
return <h3>{t('nodeNames.space')}</h3>
```

**Benefits:**

-   Each app maintains its own translations modularly
-   Unified i18n system access across all components
-   Easy addition of new languages and applications
-   No modification of core files required

## Workspace Package Architecture

### Backend Services Integration

**Workspace Package Pattern** (implemented in profile-srv):

-   **Package Name**: `@universo/profile-srv` (scoped workspace package)
-   **Integration**: Clean imports via `import { Profile, createProfileRoutes } from '@universo/profile-srv'`
-   **Benefits**: Eliminates complex relative paths, automatic dependency resolution, prepared for plugin extraction

**Integration Approaches:**

-   **Workspace Packages**: Core services with tight integration and type safety
-   **REST API**: Applications with service-to-service communication
-   **Hybrid Approach**: Core services as packages, complex apps as API services

### Future-Ready Extensibility

-   Workspace packages can be extracted to separate repositories
-   Support for microservices architecture evolution
-   Easy addition of new components and services
-   Maintained compatibility during architectural changes

---

_For detailed application structure, build instructions, and development guidelines, see [apps/README.md](../apps/README.md)_
