# UPDL Frontend (updl-frt)

Frontend for Universo Platformo Definition Language for 3D/AR/VR scene definition.

## Structure

```
src/
  ├── api/ - API clients for server communication
  ├── assets/ - Static assets (icons, images)
  │   └── icons/ - SVG icons for nodes
  ├── builders/ - Scene builder classes
  ├── components/ - React components
  ├── configs/ - Configuration constants
  ├── features/ - Feature modules (former miniapps)
  │   └── arjs/ - AR.js specific functionality
  ├── hooks/ - React hooks
  ├── i18n/ - Internationalization resources
  ├── interfaces/ - TypeScript interfaces and types
  ├── nodes/ - UPDL node definitions
  │   ├── base/ - Base node classes
  │   ├── camera/ - Camera nodes
  │   ├── light/ - Light nodes
  │   ├── object/ - Object nodes
  │   └── scene/ - Scene nodes
  ├── store/ - State management
  └── utils/ - Utility functions
```

## Build Process

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (SVG icons, images, etc.) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static assets from the source directories to the dist folder, preserving the directory structure. This ensures that icons and other resources are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

When adding new node types, follow these steps:

1. Create a new directory in the appropriate folder (e.g., `src/nodes/mynode/`)
2. Add an `index.ts` file to export all components
3. Add SVG icons to `src/assets/icons/` (they will be copied during build)
4. Update imports/exports in the main `index.ts` file

## Overview

The UPDL Frontend module provides node definitions and UI components for creating 3D/AR/VR scenes within the Flowise editor. It serves as the user-facing interface for the universal scene definition system.

### Key Components

#### Node Definitions

The UPDL system provides a set of standard nodes for scene creation:

-   **Scene Node**: Root container for a 3D scene
-   **Object Node**: 3D objects (box, sphere, cylinder, etc.)
-   **Camera Node**: Scene viewpoint configuration
-   **Light Node**: Lighting setup (point, directional, ambient)
-   **Material Node**: Surface appearance (color, texture, etc.)
-   **Group Node**: Object grouping and organization
-   **Transformation Node**: Position, rotation, and scale

Each node includes:

-   Clear icon representation in the editor
-   Configurable properties via the node panel
-   Type-safe interfaces for runtime data
-   Integration with the Flowise editing system

#### Scene Building Utilities

The `builders/` directory contains utilities for:

-   Converting node configurations to scene representations
-   Validating scene structure
-   Preparing data for export to target platforms

#### API Communication

The `api/` directory contains HTTP clients for communication with the backend:

-   Base HTTP client configuration
-   Type-safe API methods
-   Error handling and logging

#### State Management

The `store/` directory provides state management for UI components:

-   Context providers for sharing state
-   State management for exporters and scene data
-   Typed state interfaces

#### React Hooks

The `hooks/` directory contains custom React hooks:

-   API hooks for data fetching
-   UI state hooks
-   Utility hooks

## Integration

The UPDL Frontend module integrates with:

-   Flowise editor through custom node types
-   Publish Frontend (publish-frt) for exporting scenes
-   UPDL Backend (updl-srv) for server-side processing

---

_Universo Platformo | UPDL Frontend Module_
