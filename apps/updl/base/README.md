# UPDL (Universal Platform Definition Language)

Node definitions system for creating universal 3D/AR/VR spaces in Flowise.

## Description

UPDL provides a set of specialized node definitions for the Flowise editor, allowing users to create high-level abstract descriptions of 3D spaces. These descriptions can then be exported to various technologies (AR.js, Three.js, and others) through publication applications.

## Architecture

UPDL is a pure node definitions module that integrates seamlessly with Flowise:

-   **Node Definitions Only**: Contains only Flowise node class definitions
-   **No Export Logic**: All space building and export functionality is handled by the publication system
-   **Clean Integration**: Loads into Flowise via NodesPool mechanism from `dist/nodes`
-   **Minimal Dependencies**: Only what's needed for node definitions

## Interface Architecture

UPDL uses a two-layer interface system:

### UPDL Core Interfaces (`interfaces/UPDLInterfaces.ts`)

-   **Purpose**: Complete UPDL ecosystem definitions for flows, graphs, and detailed node properties
-   **Scope**: Full UPDL specification with advanced properties (materials, physics, animations)
-   **Usage**: Internal UPDL nodes, graph processing, complex scene definitions
-   **Export**: Available via UPDL module exports for advanced consumers

### Integration Interfaces (`packages/server/src/Interface.UPDL.ts`)

-   **Purpose**: Simplified interfaces for backend/frontend integration
-   **Scope**: Essential properties for space processing and publication
-   **Usage**: Publication system, API communication, AR.js conversion
-   **Export**: Available via `@server/interface` alias

This separation ensures:

-   **Clean Integration**: Publication system uses only necessary interfaces
-   **Future Flexibility**: Core UPDL can evolve without breaking integrations
-   **Optimal Performance**: Smaller interface footprint for production use

## Structure

```
src/
  ├── assets/          # Static resources (icons, images)
  │   └── icons/       # SVG icons for nodes
  ├── i18n/            # Internationalization resources
  ├── interfaces/      # TypeScript interfaces and types
  │   └── UPDLInterfaces.ts  # Complete UPDL ecosystem definitions
  ├── nodes/           # UPDL node definitions
  │   ├── base/        # Base node classes
  │   ├── camera/      # Camera node definitions
  │   ├── light/       # Light node definitions
  │   ├── object/      # Object node definitions
  │   ├── space/       # Space node definitions
  │   └── interfaces.ts # Node interfaces
  └── index.ts         # Entry point - exports node classes and interfaces
```

## Build Process

The build process consists of two stages:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static resources (SVG icons, images, etc.) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Development mode with file watching
-   `pnpm lint` - Check code with linter

### Gulp Tasks

The Gulp process copies all static resources from source directories to the dist folder, preserving directory structure. This ensures that icons and other resources are available at runtime.

## Dependencies

Make sure dependencies are installed from the project root:

```bash
pnpm install
```

## Development

When adding new node types, follow these steps:

1. Create a new directory in the appropriate folder (e.g., `src/nodes/mynode/`)
2. Add an `index.ts` file to export all components
3. Add SVG icons to `src/assets/icons/` (they will be copied during build)
4. Update imports/exports in the main `index.ts` file

## Node Integration

The UPDL module provides node definitions that integrate with Flowise:

### Node Loading

-   Node classes are loaded by Flowise NodesPool from `dist/nodes`
-   Each node extends `BaseUPDLNode` and implements Flowise node interface
-   Nodes appear in Flowise editor with proper categories and icons

### Supported Node Types

-   **Space Node**: Root container for 3D space with global settings
-   **Object Node**: 3D objects (cube, sphere, cylinder, etc.)
-   **Data Node**: Question and answer content for quiz scenes
-   **Camera Node**: Space viewpoint configuration
-   **Light Node**: Lighting setup (point, directional, ambient)
-   **Entity Node**: Runtime entity instance with transform data
-   **Component Node**: Behaviour component attached to an entity
-   **Event Node**: Trigger for actions within the scene
-   **Action Node**: Response logic for events
-   **Universo Node**: MMOOMM-specific functionality placeholder

Data nodes are used for creating quizzes. A question node can have multiple answer nodes connected to it. Answers may be marked with `isCorrect` and can optionally define `pointsValue`. These answers can also link to Object nodes that appear when chosen.

These additional nodes lay the groundwork for the **PlayCanvas MMOOMM template**, enabling future game-style exports with entities, components and event-driven logic.

Each node includes:

-   Clear icon representation in the editor
-   Configurable properties through the node panel
-   Type-safe interfaces for runtime data
-   Integration with Flowise editing system

### Space Processing

Space data processing is handled by the Flowise server via `utilBuildUPDLflow`:

-   UPDL nodes define the space structure in Flowise
-   Server processes node connections and data
-   Publication system receives processed space data
-   Final export to target platforms (AR.js, etc.)

## Integration

The UPDL module integrates with:

-   **Flowise editor** through custom node type definitions
-   **Publication system** (publish-frt/publish-srv) for space export
-   **Flowise server** for space data processing

## Node Definition Focus

This module is intentionally focused only on node definitions:

-   **No space builders** - handled by publication system
-   **No export logic** - handled by publication applications
-   **No API clients** - not needed for node definitions
-   **No state management** - nodes are stateless definitions

This clean separation ensures optimal architecture and maintainability.

---

_Universo Platformo | UPDL Module_
