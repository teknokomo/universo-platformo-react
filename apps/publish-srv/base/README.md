# Publish Server

Backend for publication system in Universo Platformo.

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
apps/publish-srv/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ controllers/        # Express controllers for request handling
   ├─ routes/             # Route configuration (REST API)
   ├─ services/           # Business logic
   ├─ models/             # Data models
   ├─ interfaces/         # TypeScript types and interfaces
   ├─ utils/              # Helper functions
   ├─ configs/            # Configurations
   ├─ middlewares/        # Middleware handlers
   ├─ validators/         # Input data validation
   └─ index.ts            # Entry point
```

### REST API

The server provides REST API for publication and project management:

#### Endpoints:

-   `POST /api/publish/projects` - Project publication
-   `GET /api/publish/projects` - Get list of published projects
-   `GET /api/publish/projects/:id` - Get specific project by ID

### Setup and Development

For development mode:

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

When adding new API endpoints, follow these steps:

1. Create a controller in the `controllers` directory
2. Define the route in the appropriate router
3. Implement the service logic in the `services` directory
4. Add any necessary utility functions in the `utils` directory

## API Endpoints

The server exposes API endpoints for:

-   Managing published content
-   Handling user permissions for publications
-   Serving published resources
-   Tracking analytics for content visibility

## Overview

The Publish Backend module provides server-side functionality for storing, managing, and serving published content. It handles:

-   Storing published projects
-   Generating and managing URLs for public access
-   Serving static content for AR/VR/3D applications
-   API endpoints for the frontend components

## Directory Structure

```
publish-srv/
└── base/
    ├── src/               # Source code
    │   ├── controllers/   # Request handlers
    │   ├── routes/        # API route definitions
    │   └── utils/         # Utility functions
    ├── dist/              # Compiled output
    ├── package.json       # Dependencies
    ├── tsconfig.json      # TypeScript configuration
    └── gulpfile.ts        # Build pipeline
```

## Key Features

### Publication Management

-   Store publication metadata and content
-   Generate unique URLs for accessing published content
-   Handle public/private visibility settings
-   Support for expiration dates

### Content Serving

-   Serve static HTML, JS, and assets
-   Support for marker-based AR through AR.js
-   Optimized delivery for mobile devices
-   Simple caching mechanisms

### API Endpoints

The backend exposes several REST endpoints including:

-   **GET** `/api/v1/publish/exporters` — List available exporters
-   **GET** `/api/v1/publish/arjs/markers` — Get supported AR.js marker presets
-   **POST** `/api/updl/publish/arjs` — Publish UPDL flow to AR.js
-   **GET** `/api/updl/publication/arjs/:publishId` — Retrieve publication metadata
-   **GET** `/p/{uuid}` — Serve published content

## Development

From the project root:

```bash
# Install dependencies
pnpm install

# Build the module
pnpm build --filter publish-srv

# Run in development mode (watches for changes)
pnpm --filter publish-srv dev
```

## Integration

The Publish Backend module integrates with:

-   Publish Frontend (publish-frt) for user interface
-   UPDL Backend (updl-srv) for scene data processing
-   Main Flowise server through mounted routes

---

_Universo Platformo | Publication Backend Module_
