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
   │  ├─ common.ts         # Base API utilities (auth, URL parsing, base URL)
   │  ├─ index.ts          # Central API exports module
   │  └─ publication/      # Publication-specific API clients
   │     ├─ PublicationApi.ts        # Base publication API for all technologies
   │     ├─ ARJSPublicationApi.ts    # AR.js specific publication API
   │     ├─ StreamingPublicationApi.ts # Streaming publication API
   │     └─ index.ts       # Publication API exports with compatibility aliases
   ├─ builders/            # **NEW**: UPDL to target platform builders
   │  ├─ common/           # Shared builder infrastructure
   │  │  ├─ BaseBuilder.ts          # Abstract base class for all builders
   │  │  ├─ BuilderRegistry.ts      # Registry for managing builders
   │  │  ├─ types.ts               # Common types and interfaces
   │  │  └─ setup.ts               # Builder registration setup
   │  ├─ arjs/             # AR.js specific builder
   │  │  ├─ ARJSBuilder.ts         # Main AR.js builder class
   │  │  ├─ handlers/              # Node-specific processors
   │  │  │  ├─ SpaceHandler.ts     # Space node processor
   │  │  │  ├─ ObjectHandler.ts    # Object node processor with multi-object support
   │  │  │  ├─ CameraHandler.ts    # Camera node processor
   │  │  │  ├─ LightHandler.ts     # Light node processor
   │  │  │  └─ index.ts           # Handlers export
   │  │  ├─ utils/                 # AR.js utilities
   │  │  │  └─ SimpleValidator.ts  # Object validation and cleanup
   │  │  └─ index.ts              # AR.js builder export
   │  └─ index.ts          # Main builders export
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  └─ arjs/             # AR.js components and logic
   ├─ hooks/               # Custom React hooks
   ├─ pages/               # Page components
   │  └─ public/           # Public pages (ARViewPage)
   ├─ routes/              # Route configuration
   ├─ i18n/                # Localization
   ├─ services/            # Service layer for backend communication
   ├─ interfaces/          # TypeScript types and interfaces
   └─ index.ts             # Entry point

```

### New Builders Architecture

The builders system provides a modular, extensible architecture for converting UPDL spaces to different target platforms:

#### Key Components

-   **BaseBuilder**: Abstract base class that all platform builders extend
-   **BuilderRegistry**: Central registry for managing different platform builders
-   **ARJSBuilder**: Concrete implementation for AR.js HTML generation
-   **Handlers**: Specialized processors for different UPDL node types (Space, Object, Camera, Light)

#### Features

-   **Modular Design**: Each UPDL node type has its own handler for specialized processing
-   **Multi-Object Support**: Handles multiple objects with automatic circular positioning to prevent overlaps
-   **Extensible**: Easy to add new target platforms (PlayCanvas, Three.js, etc.)
-   **Type Safe**: Full TypeScript support with proper interfaces
-   **Error Handling**: Robust error handling with fallbacks
-   **Validation**: Built-in validation for UPDL data integrity with SimpleValidator
-   **Positioning Algorithm**: Automatic circular arrangement for multiple objects in AR space

#### Usage

```typescript
import { ARJSBuilder } from './builders'

const builder = new ARJSBuilder()
const result = await builder.build(updlSpace, {
    projectName: 'My AR Experience',
    markerType: 'preset',
    markerValue: 'hiro'
})

console.log(result.html) // Generated AR.js HTML
console.log(result.metadata) // Build metadata
```

### Backend Interaction

The application interacts with the backend exclusively through REST API using API clients from the `api/` directory.
Direct imports from other applications are not used to ensure modularity and independence.

### Integration with Bots System

This frontend application is closely integrated with the main bots publication system located in `packages/ui/src/views/publish/bots/`:

-   **Configuration Integration**: The AR.js publisher is accessible through the main publication interface in the bots system
-   **Shared Publication State**: Publication settings are stored in Supabase using the same `chatbotConfig` structure as the main bots system
-   **Technology-Specific Configuration**: AR.js settings are stored in the `arjs` block within `chatbotConfig`, maintaining separation from chatbot settings
-   **API Route Consistency**: Uses the same Flowise API routes (`/api/v1/uniks/{unikId}/chatflows/{chatflowId}`) as the main system

### Supabase Integration

Publication state persistence is handled through Supabase integration:

-   **Multi-Technology Structure**: Settings stored in `chatbotConfig` field with structure `{"chatbot": {...}, "arjs": {...}}`
-   **Independent Publication States**: Each technology (chatbot, AR.js) has its own `isPublic` flag
-   **Auto-save Functionality**: Settings automatically saved when parameters change
-   **State Restoration**: Previous settings restored when component mounts
-   **Global Publication Status**: Overall `isPublic` flag set to true if any technology is public

### Main Components

-   `ARJSPublisher` - Component for AR.js project streaming publication with Supabase integration
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing
-   `ARJSBuilder` - **NEW**: Modular builder for converting UPDL data to AR.js HTML (replaces UPDLToARJSConverter)

### API Architecture

The application uses a modular API architecture organized into layers:

#### Core API Utilities (`api/common.ts`)

-   `getAuthHeaders()` - Authentication token management from localStorage
-   `getCurrentUrlIds()` - Extract unikId and chatflowId from URL
-   `getApiBaseUrl()` - Dynamic API base URL resolution

#### Publication API Layer (`api/publication/`)

-   **`PublicationApi`** - Base class for publication functionality across all technologies
-   **`ARJSPublicationApi`** - AR.js specific publication settings management (extends PublicationApi)
-   **`StreamingPublicationApi`** - Real-time content generation and streaming publication

#### API Integration Features

-   **Multi-Technology Support**: Publication API designed to support AR.js, Chatbot, and future technologies
-   **Supabase Integration**: Persistent storage using `chatbotConfig` structure with technology-specific blocks
-   **Backward Compatibility**: Includes compatibility aliases (`ChatflowsApi`, `ARJSPublishApi`) for seamless migration
-   **Proper Authentication**: Uses correct Flowise routes with `unikId` and `x-request-from: internal` headers
-   **Circular Dependency Prevention**: Clean architecture with `common.ts` utilities to prevent import cycles

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

The Publish Frontend module provides UI components and functionality for streaming publication of UPDL spaces to AR.js. The application has been simplified to focus on streaming generation, with integrated Supabase persistence for publication settings.

## Key Components

### ARJSPublisher

The ARJSPublisher component provides an interface for publishing AR.js spaces using streaming generation:

-   Project title and description
-   Visibility controls (public/private toggle) with Supabase persistence
-   Marker selection (currently only "hiro" marker is supported)
-   QR code for easy mobile access
-   Generated public URL for sharing
-   Auto-save functionality for all settings
-   Integration with multi-technology publication system

### ARJSExporter

The ARJSExporter component is a demo component for the "Export" tab, currently with limited functionality:

-   HTML code preview
-   Copy to clipboard function
-   Download button (demo only)

### ARViewPage

The ARViewPage component renders AR.js content from UPDL data:

-   Loads space data from the backend
-   Converts UPDL to AR.js HTML using the new `ARJSBuilder`
-   Displays the AR content in an iframe
-   Handles loading state and errors

### ARJSBuilder (NEW)

The ARJSBuilder system transforms UPDL space graphs into AR.js HTML:

-   **Modular Architecture**: Separate handlers for different node types
-   **Type Safety**: Full TypeScript support with proper validation
-   **Extensible Design**: Easy to add new UPDL node types or target platforms
-   **Error Handling**: Robust error handling with sensible fallbacks
-   **Clean HTML Generation**: Generates optimized A-Frame compatible HTML

#### Builder Components

-   **SpaceHandler**: Processes space-level configuration
-   **ObjectHandler**: Converts UPDL objects to A-Frame entities (box, sphere, cylinder, etc.)
-   **CameraHandler**: Handles camera settings (currently uses AR.js defaults)
-   **LightHandler**: Manages lighting setup with sensible defaults

### ChatflowsApi

The ChatflowsApi provides proper integration with Flowise backend:

-   Uses correct API routes with `unikId` parameter: `/api/v1/uniks/{unikId}/chatflows/{chatflowId}`
-   Includes proper authentication headers (`x-request-from: internal`)
-   Handles AR.js settings persistence to `chatbotConfig.arjs` block
-   Maintains compatibility with multi-technology publication architecture

## Workflow

The current implementation uses exclusively streaming generation for AR.js from UPDL nodes with persistent configuration:

1. Settings are automatically loaded from Supabase when component mounts
2. User configures project parameters (title, marker, etc.) - settings auto-saved
3. User toggles "Make Public" - triggers publication and saves state to Supabase
4. The `ARJSPublisher` component sends a POST request to `/api/v1/publish/arjs` with the `chatflowId` and selected options
5. The backend `PublishController.publishARJS` handler returns a response with `publicationId` and publication metadata
6. When accessing the public URL (`/p/{publicationId}`), the `ARViewPage` component is rendered
7. The component makes a GET request to `/api/v1/publish/arjs/public/:publicationId`, which returns a JSON with the UPDL space data
8. The `ARJSBuilder` system converts the UPDL space to A-Frame elements and renders them in the browser

## Integration with Flowise Core

-   The frontend interacts with the publication backend, which imports the `utilBuildUPDLflow` function from `packages/server`
-   `utilBuildUPDLflow` retrieves the chatflow from the Flowise database by `chatflowId`, assembles UPDL nodes, and executes them
-   The resulting space object is returned to the frontend as JSON, eliminating the need to store intermediate HTML files
-   Publication settings are persisted using the same Supabase structure as the main Flowise system
-   **NEW**: Server-side integration with the builders system for consistent HTML generation

## Key Files

-   `src/routes/index.tsx` — React Router configuration for public viewing
-   `src/features/arjs/ARJSPublisher.jsx` — UI for selecting parameters and initiating streaming generation with Supabase integration
-   `src/features/arjs/ARJSExporter.jsx` — Demo component for the "Export" tab
-   `src/pages/public/ARViewPage.tsx` — AR space display component
-   `src/builders/arjs/ARJSBuilder.ts` — **NEW**: Main AR.js builder replacing UPDLToARJSConverter
-   `src/builders/arjs/handlers/` — **NEW**: Specialized processors for each UPDL node type
-   `src/api/common.ts` — Core API utilities for authentication and URL management
-   `src/api/publication/PublicationApi.ts` — Base publication API client for all technologies
-   `src/api/publication/ARJSPublicationApi.ts` — AR.js specific publication API client
-   `src/api/publication/StreamingPublicationApi.ts` — Streaming publication API client
-   `src/interfaces/UPDLTypes.ts` — Interfaces for UPDL space data

## Demo Mode

For testing and demonstration, the `ARJSPublisher` component has a DEMO_MODE that can be activated by setting the constant `DEMO_MODE = true`. In this mode:

1. Template selection is displayed (currently only one demo template "Quiz")
2. No real API requests are made during publication
3. A fixed publication URL is provided
4. All UI interactions work, but without actual server operations
5. Supabase integration is disabled

## Current Limitations

-   No support for offline mode or space caching for reuse
-   No optimization for mobile devices
-   Only the "hiro" marker is currently supported
-   The Export tab is a demo only, without full HTML/ZIP export functionality

## Recent Changes

### January 2025 - Multi-Object Support Implementation

**Major feature enhancement**: Implemented full support for multiple objects in UPDL spaces:

#### ✅ Completed

-   **Multi-Object Support**: Fixed data extraction in `buildUPDLflow.ts` to properly handle multiple objects
-   **Circular Positioning**: Implemented automatic circular arrangement algorithm in `ObjectHandler`
-   **Data Validation**: Added `SimpleValidator` class for object validation and cleanup
-   **Error Handling**: Enhanced error handling with detailed logging for debugging
-   **Legacy Compatibility**: Maintains backward compatibility with single-object flows

#### Benefits

-   **No Overlapping Objects**: Multiple objects are automatically positioned in a circle to prevent visual conflicts
-   **Scalable Layout**: Dynamic radius calculation based on object count for optimal viewing
-   **Data Integrity**: Robust validation ensures consistent object properties
-   **Developer Experience**: Comprehensive logging for troubleshooting and development
-   **Production Ready**: Ready for testing with 3-5 objects as planned in MVP

### January 2025 - Builder Architecture Refactoring

**Major architectural improvement**: Replaced the monolithic `UPDLToARJSConverter.ts` with a modular builder system:

#### ✅ Completed

-   **Modular Architecture**: Created separate handlers for Space, Object, Camera, and Light nodes
-   **Base Builder System**: Implemented extensible foundation for multiple target platforms
-   **Type Safety**: Full TypeScript support with proper interfaces
-   **Clean Code**: Removed console logging and improved error handling
-   **Extensibility**: Easy to add new UPDL node types and target platforms

#### Benefits

-   **Maintainability**: Code is now organized in logical, testable modules
-   **Scalability**: Simple to add PlayCanvas, Three.js, and other target platforms
-   **Reliability**: Better error handling and validation
-   **Developer Experience**: Clear separation of concerns and proper TypeScript support

---

_Universo Platformo | Publication Frontend Module_
