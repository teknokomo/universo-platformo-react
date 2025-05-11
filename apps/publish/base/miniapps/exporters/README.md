# Exporters Base Classes

This directory contains base classes and interfaces for all exporters in the publishing system.

## Key Components

-   `BaseExporter.ts` - Abstract base class for all exporters defining common interface
-   `BaseAFrameExporter.ts` - Base class specifically for A-Frame based exporters

## Architecture

The exporter system follows a hierarchical inheritance pattern:

```
BaseExporter
    ├── BaseAFrameExporter
    │       ├── ARJSExporter
    │       └── AFrameExporter (VR)
    ├── PlayCanvasExporter
    ├── BabylonJSExporter
    └── ThreeJSExporter
```

## Implementation

Each concrete exporter implements the `export` method which:

1. Validates the scene
2. Completes any missing components
3. Converts the UPDL scene to target format
4. Generates output files (HTML, JS, assets)
5. Returns an export result

## Usage

Base classes should not be instantiated directly. Instead, use the specific exporter for your target platform:

```typescript
// Example:
const arjsExporter = new ARJSExporter()
const result = arjsExporter.export(scene, options)
```
