# UPDL (Universal Platform Definition Language)

Node definitions system for creating universal 3D/AR/VR spaces in Flowise.

## Description

UPDL provides a set of specialized node definitions for the Flowise editor, allowing users to create high-level abstract descriptions of 3D spaces. These descriptions can then be exported to various technologies (AR.js, PlayCanvas, and others) through publication applications.

## Architecture

UPDL is a pure node definitions module that integrates seamlessly with Flowise:

-   **Node Definitions Only**: Contains only Flowise node class definitions.
-   **No Export Logic**: All space building and export functionality is handled by the publication system.
-   **Clean Integration**: Loads into Flowise via the `NodesPool` mechanism from the `dist/nodes` directory.
-   **Minimal Dependencies**: Only contains dependencies required for node definitions.

## Structure

The source code has a modular structure, with each high-level node in its own directory.

```
src/
├── assets/              # Static resources (icons)
│   └── icons/
├── i18n/                # Internationalization resources
├── interfaces/          # Core TypeScript interfaces for the UPDL ecosystem
│   └── UPDLInterfaces.ts
├── nodes/               # UPDL node definitions
│   ├── action/          # ActionNode: executes a gameplay action
│   ├── base/            # BaseUPDLNode: shared base class for all UPDL nodes
│   ├── camera/          # CameraNode: defines the viewpoint
│   ├── component/       # ComponentNode: attaches behavior to an Entity
│   ├── data/            # DataNode: key-value data storage
│   ├── entity/          # EntityNode: represents a runtime game object
│   ├── event/           # EventNode: triggers actions based on events
│   ├── light/           # LightNode: defines lighting for the space
│   ├── object/          # ObjectNode (Legacy): defines a simple 3D object
│   ├── space/           # SpaceNode: the root container for a scene
│   ├── universo/        # UniversoNode: global settings for MMOOMM
│   └── interfaces.ts    # Common interfaces for nodes
└── index.ts             # Main entry point - exports all node classes and interfaces
```

## Node Integration

The UPDL module provides node definitions that integrate with the Flowise editor.

### Supported Node Types

-   **Core Nodes**:
    -   **Space**: The root container for a 3D space with global settings.
    -   **Data**: Key-value data store, often used for quizzes or game state.
    -   **Camera**: Defines the space's viewpoint and projection.
    -   **Light**: Configures lighting (point, directional, ambient).
-   **High-Level MMOOMM Nodes**:
    -   **Universo**: A global node for defining world-level rules and connectivity for an MMOOMM project. Connects to `Space`.
    -   **Entity**: A runtime instance of an object or actor in the game. Accepts `Component` and `Event` nodes as input.
    -   **Component**: Attachable behavior or data, such as a renderer (`Render`) or a `Script`. Connects to an `Entity`.
    -   **Event**: A trigger for actions, such as `OnClick` or `OnCollision`. Accepts `Action` nodes as input and connects to an `Entity`.
    -   **Action**: The logic that executes in response to an `Event`, like `Move` or `Shoot`. This is a terminal node configured via its internal properties.

### Connector Implementation Guide

To ensure nodes connect correctly on the Flowise canvas, follow these rules:

1.  **Input Connectors**: To allow a parent node to accept a child node, define the connection in the `inputs` array of the parent node's class. The `type` in the input definition must match the `name` of the child node (e.g., `type: 'UPDLEntity'`).

2.  **Output Connectors**: To get a standard output connector, simply ensure the `outputs` array in the node's class is empty (`this.outputs = [];`). Flowise will automatically generate it. Do **not** attempt to add a default output in a base class, as this will break the mechanism.

3.  **Terminal Nodes**: For nodes like `ActionNode` that are configured internally and do not connect to other nodes, define both `inputs` and `outputs` as empty arrays.

## Build Process

The build process consists of two stages:

1.  **TypeScript Compilation**: Compiles TypeScript files (`.ts`) to JavaScript (`.js`).
2.  **Gulp Tasks**: Copies all static resources (like SVG icons) from the source directories to the `dist` folder, preserving the directory structure.

### Available Scripts

-   `pnpm clean` - Cleans the `dist` directory.
-   `pnpm build` - Builds the package (runs TypeScript compilation and Gulp tasks).
-   `pnpm dev` - Runs the build in development mode with file watching.
-   `pnpm lint` - Checks the code with the linter.

## Focus of the Module

This module is intentionally focused **only on node definitions**:

-   **No Space Builders**: Handled by the publication system (`publish-frt`).
-   **No Export Logic**: Handled by publication applications.
-   **No API Clients**: Not needed for node definitions.
-   **No State Management**: Nodes are stateless definitions.

This clean separation ensures optimal architecture and maintainability.

---

_Universo Platformo | UPDL Module_
