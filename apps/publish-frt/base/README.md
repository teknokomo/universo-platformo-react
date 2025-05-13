# Publication Frontend (publish-frt)

Frontend for publication system in Universo Platformo.

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
apps/publish-frt/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ assets/              # Static files (images, fonts, icons)
   │  ├─ icons/            # SVG icons for components and UI
   │  └─ images/           # Images for UI elements
   ├─ api/                 # HTTP clients for backend interaction
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  ├─ arjs/             # AR.js components and logic
   │  ├─ aframe/           # A-Frame components and logic
   │  └─ exporters/        # Exporters for different platforms
   ├─ hooks/               # Custom React hooks
   ├─ store/               # State management
   ├─ i18n/                # Localization
   ├─ services/            # Service layer for backend communication
   ├─ utils/               # Utility functions
   ├─ interfaces/          # TypeScript types and interfaces
   ├─ configs/             # Configurations
   └─ index.ts             # Entry point

```

### Backend Interaction

The application interacts with the backend exclusively through REST API using API clients from the `api/` directory.
Direct imports from other applications are not used to ensure modularity and independence.

### Main Components

-   `Publisher` - Main component for project publication
-   `ExporterSelector` - Exporter selection component
-   `ARJSPublisher` - Specialized component for AR.js project publication

### Setup and Development

To run the project:

```bash
pnpm run dev
```

To build:

```bash
pnpm run build
```

## Build Process

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (SVG, PNG, JSON, CSS) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (SVG, PNG, JPG, JSON, CSS) from the source directories to the dist folder, preserving the directory structure. This ensures that assets are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

When adding new components or pages, follow these practices:

1. Create components in the appropriate directory
2. Use TypeScript interfaces for props and state
3. Add appropriate static assets to the same folder (they will be copied during build)
4. Implement internationalization support using the i18n system

## Overview

The Publish Frontend module provides UI components and functionality for exporting and publishing UPDL scenes to various platforms, including:

-   AR.js for augmented reality
-   A-Frame for virtual reality (future)
-   PlayCanvas for 3D web (future)
-   Three.js for 3D web (future)

## Key Components

### ARJSPublisher

The ARJSPublisher component provides a comprehensive interface for publishing AR.js scenes, including:

-   Project title and description
-   Visibility controls
-   Marker selection
-   Generation type selection (streaming/pre-generated)
-   QR code for easy mobile access

### ARJSExporter

The ARJSExporter component allows users to export AR.js scenes for offline use, including:

-   HTML code generation
-   File downloads
-   Preview options

## Integration

The Publish Frontend module integrates with:

-   UPDL Frontend (updl-frt) for scene data
-   Publish Backend (publish-srv) for storing and serving published content
-   Main Flowise UI through custom tabs and components

---

_Universo Platformo | Publication Frontend Module_
