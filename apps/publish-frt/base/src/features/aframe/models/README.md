# A-Frame Models

This directory contains the core model definitions for A-Frame entities and components. These models are used by various exporters to generate A-Frame based HTML, including:

-   AR.js exporter (for augmented reality experiences)
-   A-Frame VR exporter (for virtual reality experiences)
-   Any other exporter that uses A-Frame as its rendering engine

## File Structure

-   `AFrameModel.ts` - Core interfaces and utility functions for A-Frame entities

## Usage

Import the required components for your exporter:

```typescript
import { AFrameScene, AFrameEntity, AFrameTagType, createDefaultScene } from './models/AFrameModel'
```

## Key Components

-   `AFrameTagType` - Enum defining all supported A-Frame HTML tags
-   `AFrameEntity` - Base interface for any A-Frame entity
-   `AFrameScene` - Container for the entire A-Frame scene
-   Creation helpers - Functions like `createDefaultScene()`, `createHiroMarker()`, etc.

## Refactoring Notes

This module was moved from `apps/publish/base/features/arjs/models/` to `apps/publish/base/features/aframe/models/` to properly separate AR.js specific code from the more general A-Frame model code. This reflects that A-Frame is the fundamental technology, while AR.js is a specific application that builds upon A-Frame.
