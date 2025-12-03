# UPDL (Universal Platform Definition Language)

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

Node definitions system for creating universal 3D/AR/VR spaces in Flowise.

## Description

UPDL provides a set of specialized node definitions for the Flowise editor, allowing users to create high-level abstract descriptions of 3D spaces. These descriptions can then be exported to various technologies (AR.js, PlayCanvas, and others) through publication applications.

## Architecture

UPDL is a pure node definitions module that integrates seamlessly with Flowise:

- **Node Definitions Only**: Contains only Flowise node class definitions
- **No Export Logic**: All space building and export functionality is handled by the publication system
- **Clean Integration**: Loads into Flowise via the `NodesPool` mechanism from the `dist/nodes` directory
- **Minimal Dependencies**: Only contains dependencies required for node definitions

## Project Structure

The source code has a modular structure, with each high-level node in its own directory:

```
packages/updl/base/src/
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

### Core UPDL Nodes Support

The template system is primarily designed to process the 7 core high-level UPDL nodes:

- **Space**: Scene/screen containers
- **Entity**: Positioned objects/actors
- **Component**: Behavior/data attachments
- **Event**: Triggers (OnStart, OnClick, etc.)
- **Action**: Executors (Move, PlaySound, etc.)
- **Data**: Key-value storage
- **Universo**: Global network connectivity

**Note**: Other nodes (Object, Camera, Light) are legacy/testing nodes and may be significantly changed or removed in future versions. Focus development on the 7 core nodes.

### Node Relationships

In a typical scene, **Entities** act as containers for **Components** which add behaviour or visuals. **Events** attached to an Entity trigger **Actions** when certain conditions occur. This chain `Entity → Component → Event → Action` defines interactive logic of the space.

## Connector Implementation Guide

To ensure nodes connect correctly on the Flowise canvas, follow these rules:

1. **Input Connectors**: To allow a parent node to accept a child node, define the connection in the `inputs` array of the parent node's class. The `type` in the input definition must match the `name` of the child node (e.g., `type: 'UPDLEntity'`).

2. **Output Connectors**: To get a standard output connector, simply ensure the `outputs` array in the node's class is empty (`this.outputs = [];`). Flowise will automatically generate it. Do **not** attempt to add a default output in a base class, as this will break the mechanism.

3. **Terminal Nodes**: For nodes like `ActionNode` that are configured internally and do not connect to other nodes, define both `inputs` and `outputs` as empty arrays.

## Interface Architecture

UPDL provides two levels of TypeScript interfaces:

### Core UPDL Interfaces (`UPDLInterfaces.ts`)
Complete ecosystem definitions for flows, graphs, and detailed node properties:

- **IUPDLFlow**: Complete flow structure with nodes and edges
- **IUPDLGraph**: Graph representation for processing
- **IUPDLSpace**: Space node with all properties
- **IUPDLEntity**: Entity node with transform and components
- **IUPDLComponent**: Component attachments and behaviors
- **IUPDLEvent**: Event triggers and conditions
- **IUPDLAction**: Action executors and parameters
- **IUPDLData**: Data storage and scoping
- **IUPDLUniverso**: Network gateway configuration

### Integration Interfaces (`Interface.UPDL.ts`)
Simplified interfaces for backend/frontend integration via `@server/interface` alias:

- Streamlined versions of core interfaces
- Optimized for API communication
- Reduced complexity for integration scenarios

## Build Process

The build process consists of two stages:

1. **TypeScript Compilation**: Compiles TypeScript files (`.ts`) to JavaScript (`.js`)
2. **Gulp Tasks**: Copies all static resources (like SVG icons) from the source directories to the `dist` folder, preserving the directory structure

### Available Scripts

- `pnpm clean` - Cleans the `dist` directory
- `pnpm build` - Builds the package (runs TypeScript compilation and Gulp tasks)
- `pnpm dev` - Runs the build in development mode with file watching
- `pnpm lint` - Checks the code with the linter

## Integration with Flowise

UPDL nodes integrate seamlessly with existing Flowise functionality:

- **Node Pool Loading**: Nodes are automatically loaded into Flowise via the NodesPool mechanism
- **Visual Editor**: All nodes appear in the Flowise visual editor with proper icons and connections
- **Flow Processing**: UPDL flows can be processed alongside regular Flowise flows
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## Usage Examples

### Basic Space Creation

```typescript
// Create a simple space with an entity
const spaceNode = new SpaceNode();
spaceNode.data = {
    id: "main-space",
    type: "root",
    settings: {
        physics: true,
        lighting: "dynamic"
    }
};

const entityNode = new EntityNode();
entityNode.data = {
    transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
    },
    tags: ["player", "interactive"]
};
```

### Component Attachment

```typescript
// Add behavior to an entity
const componentNode = new ComponentNode();
componentNode.data = {
    type: "movement",
    props: {
        speed: 5.0,
        acceleration: 2.0
    }
};

// Connect component to entity
entityNode.inputs.push({
    type: "UPDLComponent",
    node: componentNode
});
```

### Event-Action Chain

```typescript
// Create event trigger
const eventNode = new EventNode();
eventNode.data = {
    eventType: "OnClick",
    source: "entity"
};

// Create action response
const actionNode = new ActionNode();
actionNode.data = {
    actionType: "Move",
    target: "entity",
    params: {
        destination: { x: 10, y: 0, z: 0 },
        duration: 2.0
    }
};

// Connect event to action
eventNode.outputs.push({
    type: "UPDLAction",
    node: actionNode
});
```

## Focus of the Module

This module is intentionally focused **only on node definitions**:

- **No Space Builders**: Handled by the publication system (`publish-frontend`)
- **No Export Logic**: Handled by publication applications
- **No API Clients**: Not needed for node definitions
- **No State Management**: Nodes are stateless definitions

This clean separation ensures optimal architecture and maintainability.

## Development Guidelines

### Adding New Nodes

1. Create a new directory under `src/nodes/`
2. Implement the node class extending `BaseUPDLNode`
3. Add appropriate TypeScript interfaces
4. Include SVG icon in `assets/icons/`
5. Export the node in `index.ts`
6. Update documentation

### Node Design Principles

- **Single Responsibility**: Each node should have one clear purpose
- **Composability**: Nodes should work well together
- **Type Safety**: Use TypeScript interfaces for all data structures
- **Visual Clarity**: Provide clear icons and descriptions
- **Documentation**: Include comprehensive JSDoc comments

## Next Steps

- [Publication System](../publish/README.md) - Learn how UPDL nodes are exported to different platforms
- [UPDL Node System](../../universo-platformo/updl-nodes/README.md) - Detailed documentation of each node type
- [MMOOMM Templates](../../universo-platformo/mmoomm-templates/README.md) - Pre-built templates using UPDL nodes
