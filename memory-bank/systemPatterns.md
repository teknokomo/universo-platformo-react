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

## Template Package Architecture Patterns

### Shared Package Pattern

**Purpose**: Centralize common functionality across multiple applications

**Structure**:

```
apps/package-name/
├── base/
│   ├── src/
│   │   ├── interfaces/     # TypeScript interfaces
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output
│   │   ├── cjs/           # CommonJS modules
│   │   ├── esm/           # ES modules
│   │   └── types/         # TypeScript declarations
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Dual Build System**: Support both CJS and ESM for maximum compatibility
-   **Type-Only Packages**: Separate types from runtime code when possible
-   **Workspace Dependencies**: Use `workspace:*` for internal dependencies
-   **Zero Runtime Dependencies**: Minimize external dependencies in shared packages

### Template Package Pattern

**Purpose**: Encapsulate platform-specific template functionality

**Structure**:

```
apps/template-name/
├── base/
│   ├── src/
│   │   ├── platform/       # Platform-specific implementations
│   │   ├── handlers/       # UPDL node handlers
│   │   ├── builders/       # Main builder classes
│   │   ├── common/         # Shared utilities
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output (CJS + ESM + Types)
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Handler Separation**: Separate handlers for different UPDL node types
-   **Builder Interface**: Implement consistent ITemplateBuilder interface
-   **Platform Isolation**: Keep platform-specific code in dedicated directories
-   **Modular Architecture**: Enable easy testing and maintenance

### Template Registry Pattern

**Purpose**: Dynamic template loading and management

**Implementation**:

```typescript
class TemplateRegistry {
    private static templates = new Map<string, TemplateInfo>()

    static registerTemplate(template: TemplateInfo) {
        this.templates.set(template.id, template)
    }

    static createBuilder(templateId: string): ITemplateBuilder {
        const template = this.templates.get(templateId)
        return new template.builder()
    }
}
```

**Key Principles**:

-   **Dynamic Loading**: Templates are loaded at runtime
-   **Type Safety**: All templates implement ITemplateBuilder interface
-   **Extensibility**: Easy to add new templates without core changes
-   **Isolation**: Templates are self-contained packages

### UPDLProcessor Pattern

**Purpose**: Convert flow data to structured UPDL representations

**Key Features**:

-   **Multi-Scene Detection**: Automatically detect single vs multi-scene flows
-   **Node Relationship Mapping**: Maintain edge relationships between nodes
-   **Type Safety**: Use shared types from @universo-platformo/types
-   **Error Handling**: Robust error handling with fallbacks

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

## Build, Packaging, and Integration Patterns (2025-08-31)

### Build Order & Workspace Graph

-   Combine Turborepo `dependsOn: ["^build"]` with explicit `workspace:*` dependencies in consumers to enforce correct order. Example: `flowise-ui` → `@universo/template-quiz`, `@universo/template-mmoomm`, `publish-frt`.
-   Avoid cycles: feature/front packages (e.g., `finance-frt`) must never depend on UI (`flowise-ui`). UI is the top-level consumer.
-   Cold start requires upstream packages (templates/publish) to build before UI/server; declare deps accordingly. Optionally add `publish-frt` as a server dep to ensure `/assets` exist.

### Template Package Exports & Types

-   Ship dual builds with proper `exports` mapping to `dist/esm` and `dist/cjs`, plus `dist/types`. Provide multi-entry exports (`./arjs`, `./playcanvas`) when needed.
-   Consumers reference template declaration files via tsconfig `paths` to `dist/index.d.ts` instead of source.

### i18n Entry Points (TypeScript)

-   Use `.ts` entry files for package i18n to ensure inclusion in `dist` and strong typing; keep `resolveJsonModule: true` for JSON locales.
-   Provide typed helpers like `getTemplateXxxTranslations(language: string)` to return a single namespace.

### Vite + Workspace Libraries

-   Prefer building libraries prior to UI. Use `optimizeDeps.include` and `build.commonjsOptions.include` for workspace packages only if necessary; avoid aliasing to `src` in production builds.

### Uniks Child Resource Integration

-   New bounded contexts (e.g., Finance) integrate as Uniks children:
    -   Server: export `entities` and `migrations` arrays and `createXxxRouter()`; mount under `/api/v1/uniks/:unikId/...`.
    -   UI: add nested routes inside Unik workspace and include namespaced i18n.

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
