# UPDL Module

This module provides the core implementation of the UPDL (Universal Platform Description Language) system for the Universo Platformo React project. It enables definition, registration, and export of UPDL node-based flows to various target platforms.

## Overview

-   **Purpose**: Offer a unified intermediate representation (UPDL) for 3D/AR/VR scenes that can be exported to multiple rendering engines (AR.js/A-Frame, PlayCanvas, Babylon.js, Three.js, etc.).
-   **Functionality**:
    -   Define and register custom UPDL nodes (Scene, Object, Camera, Light, etc.)
    -   Convert Flowise flow graphs to UPDL format
    -   Manage collection of exporters and perform export operations
    -   Provide a stable API for client and server integration

## Current Status

-   **Development Phase**: Foundation Phase (Phase 1)
-   **Implementation Progress**:

    -   Core UPDL architecture - ✅ Complete
    -   Base node interfaces - ✅ Complete
    -   AR.js/A-Frame exporter - 🔄 In active development
    -   Publication system UI - 🔄 In progress
    -   AR.js marker scene testing - 🔄 In progress
    -   Other exporters (PlayCanvas, Three.js, Babylon.js) - ⏳ Planned

-   **Current Sprint Focus**:

    -   Completing the AR.js publication workflow
    -   Testing marker-based scenes (red cube on Hiro marker)
    -   Finalizing the publication UI
    -   Implementing the `/p/{uuid}` URL scheme for published content

-   **Pending Tasks**:
    -   AR.js System Complete Removal - In progress
    -   Publication interface refinement - In progress
    -   QR code implementation for mobile access - Planned
    -   Full end-to-end testing of publication workflow - Planned

## Installation

From the repository root, install dependencies and build:

```bash
pnpm install
pnpm build --filter @universo-platformo/react-updl
```

## Usage

```ts
import { getUPDL, exportUPDLFlow, getAvailableExporters } from '@apps/updl'

// Initialize and get API
const { exportAPI } = getUPDL()

// Retrieve available exporters
const exporters = getAvailableExporters()

// Convert a Flowise flow to UPDL format
const updlFlow = convertFlowiseToUPDL(flowiseFlow)

// Export the UPDL flow using AR.js exporter
const result = await exportUPDLFlow(updlFlow, 'arjs', { title: 'Test Scene' })
```

## API Reference

### `getUPDL(options?)`

Initializes or retrieves the global UPDL instance.

**Parameters:**

-   `options` (optional): Configuration object
    -   `forceNew`: Boolean to force creation of a new instance
    -   `logLevel`: Logging verbosity level ('error', 'warn', 'info', 'debug')

**Returns:** Object containing the UPDL instance and export API

### `exportUPDLFlow(flow, exporterId, options)`

Exports a UPDL flow with the specified exporter.

**Parameters:**

-   `flow`: UPDLFlow object containing the scene graph
-   `exporterId`: String identifier for the target exporter (e.g., 'arjs', 'playcanvas')
-   `options`: Exporter-specific options object
    -   Common options: `title`, `description`, `author`
    -   AR.js specific: `marker`, `patternRatio`

**Returns:** Promise resolving to an export result object containing generated assets

### `getAvailableExporters()`

Lists all registered exporter information.

**Returns:** Array of exporter metadata objects with id, name, description, and capabilities

### `convertFlowiseToUPDL(flowiseFlow)`

Converts a Flowise flow definition to UPDL format.

**Parameters:**

-   `flowiseFlow`: Flowise flow object containing nodes and edges

**Returns:** UPDLFlow object ready for export

## File Structure

```
apps/updl/
├── package.json          # Module dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── i18n/                 # Localization files (en/ru)
├── imp/                  # Implementation source code
│   ├── index.ts          # Entry point and API exports
│   ├── initialize.ts     # UPDL initialization and exporter manager setup
│   ├── UPDLSceneBuilder.ts # Logic to build UPDL scene graphs
│   ├── icons/            # Node icon assets
│   ├── nodes/            # UPDL node definitions (scene, object, camera, light, etc.)
│   ├── interfaces/       # TypeScript interfaces for UPDLFlow and exporters
│   ├── api/              # REST or programmatic API wrappers
│   ├── exporters/        # Platform-specific exporter implementations
│   ├── miniapps/         # Example or minimal application consumers
│   ├── builders/         # Helpers for constructing node graphs
│   └── utils/            # Utility functions (formatters, validators)
├── dist/                 # Compiled output (ignored in source control)
├── .turbo/               # Turborepo cache and metadata
└── node_modules/         # Dependencies
```

## Key Files

### Core Files

-   **imp/index.ts**: Main entry point that exports public API functions
-   **imp/initialize.ts**: Sets up UPDL system and registers default exporters and nodes
-   **imp/UPDLSceneBuilder.ts**: Core logic for constructing UPDL scene graphs from node definitions

### Interfaces

-   **imp/interfaces/UPDLFlow.ts**: TypeScript interface definitions for UPDL scene graph structure
-   **imp/interfaces/UPDLNode.ts**: Base interfaces for all node types
-   **imp/interfaces/UPDLExporter.ts**: Interfaces for exporter implementations

### Nodes

-   **imp/nodes/base/BaseNode.ts**: Abstract base class with common node functionality
-   **imp/nodes/scene/SceneNode.ts**: Root container for 3D scenes (required for all exports)
-   **imp/nodes/object/ObjectNode.ts**: Represents 3D objects with geometry and materials
    -   **imp/nodes/object/CubeNode.ts**: Specialized object node for cube primitives
    -   **imp/nodes/object/ModelNode.ts**: Node for importing external 3D models
-   **imp/nodes/camera/CameraNode.ts**: Defines viewpoints within the scene
-   **imp/nodes/light/LightNode.ts**: Various light source implementations
    -   **imp/nodes/light/AmbientLightNode.ts**: Global ambient lighting
    -   **imp/nodes/light/DirectionalLightNode.ts**: Directional light sources

### Exporters

-   **imp/exporters/BaseExporter.ts**: Abstract base class for all exporters
-   **imp/exporters/ARJSExporter.ts**: Exports scenes to AR.js/A-Frame format
-   **imp/exporters/UPDLToAFrame.ts**: Utility for converting UPDL objects to A-Frame elements
-   **imp/exporters/AFrameModel.ts**: Representation of A-Frame scene elements

### API Integration

-   **imp/api/UPDLAPI.ts**: Client-facing API for consuming UPDL functionality
-   **imp/api/ExporterManager.ts**: Manages collection of registered exporters
-   **imp/api/NodeRegistry.ts**: Registry for available UPDL node types

### Utilities

-   **imp/utils/formatters.ts**: Utilities for formatting UPDL and export output
-   **imp/utils/validators.ts**: Validation helpers for UPDL structures

## Exporters

Currently implemented exporters:

| Exporter ID | Target Platform | Description                                     | Status               |
| ----------- | --------------- | ----------------------------------------------- | -------------------- |
| `arjs`      | AR.js/A-Frame   | Exports to web-based AR using AR.js and A-Frame | In development       |
| `html`      | Web/HTML        | Simple HTML preview of the scene (for testing)  | Basic implementation |

Planned exporters (scheduled for Phase 3):

-   PlayCanvas (React & Engine) - Q2 2025
-   Three.js - Q2 2025
-   Babylon.js - Q3 2025
-   A-Frame VR - Q3 2025

## Node Types and Parameters

### Scene Node

Root container for all scene elements.

**Parameters:**

-   `title`: Scene title
-   `description`: Optional scene description
-   `backgroundColor`: Background color (hex)

### Object Node

Base class for 3D objects in the scene.

**Parameters:**

-   `position`: Vector3 position (x, y, z)
-   `rotation`: Euler rotation (x, y, z)
-   `scale`: Vector3 scale (x, y, z)
-   `material`: Material properties (color, texture, etc.)

### Camera Node

Defines viewpoints and projection parameters.

**Parameters:**

-   `position`: Vector3 position (x, y, z)
-   `lookAt`: Target point to look at (x, y, z)
-   `fov`: Field of view in degrees
-   `near`: Near clipping plane
-   `far`: Far clipping plane

### Light Node

Base class for light sources in the scene.

**Parameters:**

-   `color`: Light color (hex)
-   `intensity`: Light intensity (0.0-1.0)
-   `castShadow`: Whether the light casts shadows

## Component Interaction

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│                 │     │                   │     │                  │
│  Flowise Flow   │────▶│  UPDLSceneBuilder │────▶│    UPDLFlow     │
│                 │     │                   │     │                  │
└─────────────────┘     └───────────────────┘     └────────┬─────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│                 │     │                   │     │                  │
│  Export Result  │◀────│    BaseExporter   │◀────│ ExporterManager  │
│                 │     │  (ARJSExporter)   │     │                  │
└─────────────────┘     └───────────────────┘     └──────────────────┘
```

1. **Flow Conversion**: Flowise flows are converted to UPDL format
2. **Scene Building**: UPDLSceneBuilder processes nodes into a complete scene graph
3. **Export Selection**: ExporterManager selects the appropriate exporter
4. **Target Export**: Exporter transforms UPDL to target format (e.g., AR.js/A-Frame)

## Test Scenario

To verify AR.js publication functionality, a simple test scene is used:

### Red Cube on Hiro Marker (AR.js Test)

This test scenario is based on the following A-Frame/AR.js reference implementation:

```html
<!DOCTYPE html>
<html>
    <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <body style="margin : 0px; overflow: hidden;">
        <a-scene embedded arjs>
            <a-marker preset="hiro">
                <!-- red cube instead of a 3D model -->
                <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>
    </body>
</html>
```

This test is being used to validate the AR.js exporter implementation by comparing the generated output with this reference implementation. The test involves:

1. Creating a UPDL scene with a red cube
2. Publishing it using the AR.js exporter
3. Verifying that the cube appears correctly on a Hiro marker
4. Comparing the behavior with the reference implementation

## Examples

### Basic AR.js Export

```ts
import { getUPDL, exportUPDLFlow } from '@apps/updl'

// Create a simple UPDL flow with a scene, camera and red cube
const updlFlow = {
    nodes: [
        {
            id: 'scene1',
            type: 'scene',
            data: { title: 'Simple AR Scene' }
        },
        {
            id: 'camera1',
            type: 'camera',
            data: { position: { x: 0, y: 0, z: 5 } }
        },
        {
            id: 'cube1',
            type: 'cube',
            data: {
                position: { x: 0, y: 0.5, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                material: { color: '#FF0000' }
            }
        }
    ],
    edges: [
        { source: 'scene1', target: 'camera1' },
        { source: 'scene1', target: 'cube1' }
    ]
}

// Export to AR.js with Hiro marker
const result = await exportUPDLFlow(updlFlow, 'arjs', {
    title: 'Red Cube AR',
    marker: 'hiro'
})

console.log('Export successful: ', result.files)
// Output contains: index.html, marker.html, and other assets
```

### Publishing AR Scene

```ts
import { getUPDL, exportUPDLFlow, publishExport } from '@apps/updl'

// Export the UPDL flow
const exportResult = await exportUPDLFlow(updlFlow, 'arjs', { title: 'Published Scene' })

// Publish the exported result
const publishResult = await publishExport(exportResult, {
    title: 'My AR Scene',
    description: 'A simple AR scene with a red cube',
    isPublic: true
})

console.log('Published scene URL:', publishResult.publicUrl)
// URL format: /p/{uuid}
```

## Contributing

Feel free to open issues or pull requests. Make sure to run `pnpm lint` and `pnpm test` before pushing changes. Follow the existing code style in TypeScript and include documentation for new nodes or exporters.

### Adding a New Node Type

1. Create a new TypeScript file in the appropriate nodes subdirectory
2. Extend the BaseNode class and implement required methods
3. Register the node in `initialize.ts`
4. Ensure all exporters support the new node type

### Adding a New Exporter

1. Create a new exporter class extending BaseExporter
2. Implement the required export methods
3. Register the exporter in `initialize.ts`
4. Add relevant tests and examples

---

_Universo Platformo | UPDL Module Documentation_
