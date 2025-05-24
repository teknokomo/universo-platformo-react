# Publication Frontend (publish-frt)

Frontend for the AR.js publication system in Universo Platformo.

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
   │  └─ arjs/             # AR.js components and logic
   ├─ hooks/               # Custom React hooks
   ├─ pages/               # Page components
   │  └─ public/           # Public pages (ARViewPage)
   ├─ routes/              # Route configuration
   ├─ i18n/                # Localization
   ├─ services/            # Service layer for backend communication
   ├─ utils/               # Utility functions (UPDLToARJSConverter)
   ├─ interfaces/          # TypeScript types and interfaces
   └─ index.ts             # Entry point

```

### Backend Interaction

The application interacts with the backend exclusively through REST API using API clients from the `api/` directory.
Direct imports from other applications are not used to ensure modularity and independence.

### Main Components

-   `ARJSPublisher` - Component for AR.js project streaming publication
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing
-   `UPDLToARJSConverter` - Utility for converting UPDL data to AR.js HTML

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

The Publish Frontend module provides UI components and functionality for streaming publication of UPDL spaces to AR.js. The application has been simplified to focus on streaming generation, removing unused components and features.

## Key Components

### ARJSPublisher

The ARJSPublisher component provides an interface for publishing AR.js spaces using streaming generation:

-   Project title and description
-   Visibility controls (public/private toggle)
-   Marker selection (currently only "hiro" marker is supported)
-   QR code for easy mobile access
-   Generated public URL for sharing

### ARJSExporter

The ARJSExporter component is a demo component for the "Export" tab, currently with limited functionality:

-   HTML code preview
-   Copy to clipboard function
-   Download button (demo only)

### ARViewPage

The ARViewPage component renders AR.js content from UPDL data:

-   Loads space data from the backend
-   Converts UPDL to AR.js HTML using `UPDLToARJSConverter`
-   Displays the AR content in an iframe
-   Handles loading state and errors

### UPDLToARJSConverter

The UPDLToARJSConverter utility transforms UPDL space graphs into AR.js HTML:

-   Converts various 3D object types (box, sphere, cylinder, etc.)
-   Handles position, rotation, scale, and color
-   Includes error handling and fallbacks
-   Adds loading screen and user instructions

## Workflow

The current implementation uses exclusively streaming generation for AR.js from UPDL nodes:

1. The `ARJSPublisher` component sends a POST request to `/api/v1/publish/arjs` with the `chatflowId` and selected options.
2. The backend `PublishController.publishARJS` handler returns a response with `publicationId` and publication metadata.
3. When accessing the public URL (`/p/{publicationId}`), the `ARViewPage` component is rendered.
4. The component makes a GET request to `/api/v1/publish/arjs/public/:publicationId`, which returns a JSON with the UPDL space data.
5. The `UPDLToARJSConverter` utility converts the UPDL space to A-Frame elements and renders them in the browser.

## Integration with Flowise Core

-   The frontend interacts with the publication backend, which imports the `utilBuildUPDLflow` function from `packages/server`.
-   `utilBuildUPDLflow` retrieves the chatflow from the Flowise database by `chatflowId`, assembles UPDL nodes, and executes them.
-   The resulting space object is returned to the frontend as JSON, eliminating the need to store intermediate HTML files.

## Key Files

-   `src/routes/index.tsx` — React Router configuration for public viewing
-   `src/features/arjs/ARJSPublisher.jsx` — UI for selecting parameters and initiating streaming generation
-   `src/features/arjs/ARJSExporter.jsx` — Demo component for the "Export" tab
-   `src/pages/public/ARViewPage.tsx` — AR space display component
-   `src/api/ARJSPublishApi.ts` — API client for server requests
-   `src/services/api.ts` — Utilities for authentication and URL handling
-   `src/utils/UPDLToARJSConverter.ts` — Utility for converting UPDL schema to AR.js elements
-   `src/interfaces/UPDLTypes.ts` — Interfaces for UPDL space data

## Demo Mode

For testing and demonstration, the `ARJSPublisher` component has a DEMO_MODE that can be activated by setting the constant `DEMO_MODE = true`. In this mode:

1. Template selection is displayed (currently only one demo template "Quiz")
2. No real API requests are made during publication
3. A fixed publication URL is provided
4. All UI interactions work, but without actual server operations

## Current Limitations

-   No support for offline mode or space caching for reuse
-   No optimization for mobile devices
-   Only the "hiro" marker is currently supported
-   The Export tab is a demo only, without full HTML/ZIP export functionality

---

_Universo Platformo | Publication Frontend Module_
