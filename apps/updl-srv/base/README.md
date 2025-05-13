# UPDL Server (updl-srv)

Backend for Universo Platformo Definition Language for 3D/AR/VR scene definition.

## Structure

```
src/
  ├── api/ - Legacy API endpoints (for backward compatibility)
  ├── configs/ - Configuration constants
  ├── controllers/ - Express controllers for request handling
  ├── interfaces/ - TypeScript interfaces and types
  ├── middlewares/ - Middleware handlers
  ├── models/ - Data models
  ├── routes/ - Route configuration (REST API)
  ├── services/ - Business logic implementation
  │   └── exporters/ - Exporters for different platforms
  ├── utils/ - Helper functions
  └── validators/ - Input data validation
```

## Build Process

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (JSON, HTML, templates) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (JSON, HTML, etc.) from the source directories to the dist folder, preserving the directory structure. This ensures that configuration files and templates are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

### Adding New Exporters

When adding new exporters, follow these steps:

1. Create a new file in `src/services/exporters/` directory
2. Implement the `Exporter` interface
3. Register the exporter in `ExporterRegistry.ts`
4. Create corresponding controller and routes
5. Test by calling the appropriate API endpoints

### Adding New API Endpoints

When adding new API endpoints, follow these steps:

1. Create or update a controller in the `controllers` directory
2. Define the route in the appropriate router file in `routes`
3. Implement any necessary validators in `validators`
4. Implement the service logic in the `services` directory
5. Add any required utility functions in the `utils` directory

## REST API Endpoints

The server exposes the following API endpoints:

-   `GET /api/updl/exporters` - Get all available exporters
-   `GET /api/updl/exporters/byFeature/:feature` - Get exporters supporting a specific feature
-   `POST /api/updl/export` - Export a UPDL flow using a specific exporter
-   `POST /api/updl/export/convert` - Convert a Flowise flow to UPDL format

## Key Components

### Exporters

The `services/exporters/` directory contains exporters for different target platforms:

-   **ARJSExporter**: Exports UPDL scenes to AR.js/A-Frame
-   **AFrameExporter**: Exports UPDL scenes to A-Frame VR
-   **PlayCanvasExporter**: (Future) Exports UPDL scenes to PlayCanvas
-   **BabylonExporter**: (Future) Exports UPDL scenes to Babylon.js
-   **ThreeJSExporter**: (Future) Exports UPDL scenes to Three.js

### Controllers

The `controllers/` directory contains request handlers:

-   **exporterController**: Handles exporter-related requests
-   Additional controllers for other features

### Middleware

The `middlewares/` directory contains Express middleware:

-   **errorHandler**: Global error handling middleware
-   Additional middleware for authentication, logging, etc.

### Validators

The `validators/` directory contains request validation:

-   **requestValidator**: Validates request body against schema

## Integration

The UPDL Server module integrates with:

-   UPDL Frontend (updl-frt) for scene data
-   Publish Server (publish-srv) for storing and serving published content
-   Main Flowise server through mounted routes

---

_Universo Platformo | UPDL Backend Module_
