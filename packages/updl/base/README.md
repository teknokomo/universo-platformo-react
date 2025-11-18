# @universo/updl

> 🌐 UPDL (Universal Platform Definition Language) - Node definitions system for creating universal 3D/AR/VR spaces

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/updl` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (Flowise Node Definitions) |
| **Build** | ES module with resources |
| **Purpose** | Node definitions system for creating universal 3D/AR/VR spaces |

## 🚀 Key Features

- 🌐 **Universal Platform Definition Language** - Unified way to describe 3D spaces
- 🎯 **7 Core Nodes** - Space, Entity, Component, Event, Action, Data, Universo
- 🔗 **Flowise Integration** - Seamless integration via NodesPool mechanism
- 🎨 **Technology Support** - AR.js, PlayCanvas and others via publication system
- 🌍 **Internationalization** - Full i18n support
- ⚡ **TypeScript-first** - Complete interface typing

## Description

UPDL provides a set of specialized node definitions for the Flowise editor, allowing users to create high-level abstract descriptions of 3D spaces. These descriptions can then be exported to various technologies (AR.js, PlayCanvas, and others) through publication applications.

## Architecture

UPDL is a pure node definitions module that integrates seamlessly with Flowise:

- **Node Definitions Only**: Contains only Flowise node class definitions
- **No Export Logic**: All space building and export functionality is handled by the publication system
- **Clean Integration**: Loads into Flowise via the `NodesPool` mechanism from the `dist/nodes` directory
- **Minimal Dependencies**: Only contains dependencies required for node definitions

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

The UPDL system is built around **7 core high-level nodes** that provide a complete framework for describing interactive 3D/AR/VR experiences:

| Node          | Purpose                                                          | Key Fields                             |
| ------------- | ---------------------------------------------------------------- | -------------------------------------- |
| **Space**     | Scene/screen containers. Can be nested                           | id, type (root/module/block), settings |
| **Entity**    | Positioned object/actor within Space                             | transform, tags                        |
| **Component** | Adds data/behavior to Entity (render, sound, script)             | type, props                            |
| **Event**     | Trigger (OnStart, OnClick, OnTimer...)                           | eventType, source                      |
| **Action**    | Executor (Move, PlaySound, SetData...)                           | actionType, target, params             |
| **Data**      | Value storage; scoped as Local, Space, Global                    | key, scope, value                      |
| **Universo**  | Gateway to Kiberplano global network (GraphQL, MQTT UNS, OPC UA) | transports, discovery, security        |

#### Core UPDL Nodes Support

The template system is primarily designed to process the 7 core high-level UPDL nodes:

-   **Space**: Scene/screen containers
-   **Entity**: Positioned objects/actors
-   **Component**: Behavior/data attachments
-   **Event**: Triggers (OnStart, OnClick, etc.)
-   **Action**: Executors (Move, PlaySound, etc.)
-   **Data**: Key-value storage
-   **Universo**: Global network connectivity

**Note**: Other nodes (Object, Camera, Light) are legacy/testing nodes and may be significantly changed or removed in future versions. Focus development on the 7 core nodes.

In a typical scene, **Entities** act as containers for **Components** which add behaviour or visuals. **Events** attached to an Entity trigger **Actions** when certain conditions occur. This chain `Entity → Component → Event → Action` defines interactive logic of the space.

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

### Testing

```bash
pnpm --filter updl test
```

The Vitest suite validates Flowise node ports and lead-collection flags to keep the editor experience aligned with the README guidance.

## Focus of the Module

This module is intentionally focused **only on node definitions**:

-   **No Space Builders**: Handled by the publication system (`publish-frt`).
-   **No Export Logic**: Handled by publication applications.
-   **No API Clients**: Not needed for node definitions.
-   **No State Management**: Nodes are stateless definitions.

This clean separation ensures optimal architecture and maintainability.

## Contributing

When contributing to this package:

1. Follow TypeScript best practices
2. Adhere to the 7 core UPDL node types
3. Add tests for new node definitions or connectors
4. Update OpenAPI specifications for node interfaces
5. Update both EN and RU documentation
6. Follow the project's coding standards

## Related Documentation

- [Main Apps Documentation](../README.md)
- [Publishing Frontend](../publish-frt/base/README.md)
- [Space Builder](../space-builder-frt/base/README.md)
- [Template MMOOMM](../template-mmoomm/base/README.md)
- [Flowise Documentation](https://docs.flowiseai.com/)

---

_Universo Platformo | UPDL Module_
