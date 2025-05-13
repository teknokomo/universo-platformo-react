# AR.js Exporter

This directory contains components specific to AR.js export functionality. AR.js is a web-based augmented reality framework built on top of A-Frame.

## Architecture

The AR.js exporter follows a layered architecture:

1. **Core Models** - Defined in `../aframe/models/AFrameModel.ts`
2. **Converters** - Transform UPDL objects to AR.js-specific A-Frame components
3. **Generators** - Generate HTML for AR.js scenes
4. **Publisher** - React UI component for configuring and publishing AR.js experiences

## Key Components

-   `ARJSExporter.ts` - Main export class for generating AR.js HTML
-   `ARJSPublisher.jsx` - React component for the publication UI
-   `generators/ARJSHTMLGenerator.ts` - HTML generation from A-Frame models
-   `converters/UPDLToARJS.ts` - Converts UPDL scenes to AR.js compatible A-Frame models

## Dependencies

-   A-Frame Models (`../aframe/models/AFrameModel.ts`)
-   Base A-Frame Exporter (`../exporters/BaseAFrameExporter.ts`)
-   UPDL API (`../../api/updlApi.ts`)

## Recent Changes

-   Core A-Frame models have been moved to the `../aframe/models/` directory
-   AR.js specific functionality remains in this directory

## Usage

The AR.js exporter is used by the UPDL system to convert scene graphs to marker-based augmented reality experiences viewable on the web.
