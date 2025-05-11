# Publish Module

This module provides the publication system for Universo Platformo.
It supports converting UPDL flows into deployable content via server-side APIs and client-side React components, with current focus on AR.js export and future extensibility for other rendering engines.

## Features

-   Express REST API for publishing workflows and retrieving published assets
-   React components for embedding publication UI in applications
-   UPDL-to-AR.js conversion pipeline
-   Static hosting of generated HTML under `/published/{uuid}` and `/p/{uuid}`

## Installation

From the repository root, install dependencies and build the publish module:

```bash
pnpm install
pnpm build --filter publish
```

To watch TypeScript changes in development:

```bash
pnpm --filter publish dev
```

## Development Server

To start the Express API server (if applicable, usually part of a larger server structure or run via `pnpm dev` if it includes server start):

```bash
# This might be integrated into the main server or require specific run scripts
# For watching changes and rebuilding:
pnpm --filter publish dev
# To run a built version, you might need a separate start script or integrate into the main server app.
```

## Usage

### Express API Endpoints

Mount the publish server in your application or run standalone via `startServer()`.

Default routes:

-   **GET** `/api/v1/publish/exporters` — List all available exporters
-   **POST** `/api/v1/publish` — Publish a UPDL flow (body: `{ flowId, exporterId, options }`)
-   **GET** `/api/v1/publish/arjs/markers` — Get supported AR.js marker presets
-   **GET** `/api/updl/scene/:id` — Get raw UPDL scene data for a flow
-   **POST** `/api/updl/publish/arjs` — Publish UPDL flow to AR.js (body: `{ sceneId, title, html, markerType, markerValue }`)
-   **GET** `/api/updl/publication/arjs/:publishId` — Retrieve AR.js publication metadata
-   **GET** `/api/updl/publications/arjs` — List all AR.js publications

Static hosting:

-   **GET** `/p/{uuid}` — Serve embedded (frameless) content
-   **GET** `/published/{uuid}` — Serve full-page published content

### React Components

Import and use the `Publisher` component or specific miniapp:

```tsx
import { Publisher } from '@apps/publish/base/components/Publisher'
// or micro-app:
import { ARJSPublisher } from '@apps/publish/base/miniapps/arjs/ARJSPublisher'
```

Programmatic API services:

```ts
import { getExporters, publishFlow, getARJSMarkers, publishARJSFlow } from '@apps/publish/base/services/api'
```

## Directory Structure

```plain
apps/publish/
├── base/                  # Core publish functionality
│   ├── package.json         # Metadata and scripts (moved to apps/publish/package.json)
│   ├── tsconfig.json        # TypeScript configuration (moved to apps/publish/tsconfig.json)
│   ├── gulpfile.ts          # Gulp tasks for build processes
│   ├── index.ts             # Main entry point for the base module
│   ├── common/              # Shared types, constants, etc.
│   │   └── types.ts         # Type definitions
│   ├── srv/                 # Backend API server (Express)
│   │   ├── server.ts        # Initializes Express with routes and static assets
│   │   ├── routes/          # Route definitions
│   │   ├── controllers/     # Request handlers
│   │   ├── utils/           # Backend utility modules
│   │   └── layouts/         # HTML templates (if any for server-side rendering)
│   ├── api/                 # Client-side Axios wrappers for backend API
│   ├── components/          # React UI components
│   ├── interfaces/          # TypeScript interfaces for React components and client-side logic
│   ├── miniapps/            # Technology-specific publisher UIs or logic
│   │   ├── aframe/          # A-Frame related components/logic
│   │   └── arjs/            # AR.js related components/logic
│   ├── services/            # Client-side service functions (e.g., consolidating API calls)
│   └── i18n/                # Localization files
├── dist/                    # Compiled output
├── package.json             # Module dependencies and scripts for the Publish app
├── tsconfig.json            # TypeScript configuration for the Publish app
├── gulpfile.ts              # Gulp tasks for the Publish app (SVG icons copying, etc.)
├── README.md                # This documentation
└── node_modules/            # Dependencies
```

## Key Files

-   **srv/server.ts**: Sets up Express with CORS, JSON, static serving, and mounts publish & UPDL routes.
-   **srv/routes/**: Defines REST endpoints for publishing and UPDL operations.
-   **srv/controllers/**: Implements business logic for publishing and UPDL scene construction.
-   **srv/utils/updlToARJSBuilder.ts**: Builds UPDL scene data for AR.js HTML generation.
-   **components/Publisher.tsx**: Main React component orchestrating publication flow.
-   **miniapps/arjs/ARJSPublisher.jsx**: UI for AR.js publishing.
-   **miniapps/aframe/models/AFrameModel.ts**: Core model definitions for A-Frame entities.
-   **services/api.ts**: Wrappers around Axios for client-side API calls.

For more details, explore each folder and file in the structure above.

## Integration with UPDL Module

The Publish module works closely with the UPDL module to transform flow graphs into publishable content:

```
┌────────────────┐     ┌────────────────┐     ┌────────────────────┐
│                │     │                │     │                    │
│  Flowise Flow  │────▶│  UPDL Module   │────▶│  Publish Module    │
│  Editor        │     │  (Converter)   │     │  (APIs & UI)       │
│                │     │                │     │                    │
└────────────────┘     └────────────────┘     └─────────┬──────────┘
                                                        │
                                                        ▼
┌────────────────┐     ┌────────────────┐     ┌────────────────────┐
│                │     │                │     │                    │
│  Public URL    │◀────│  Storage       │◀────│  HTML/Assets       │
│  /p/{uuid}     │     │  Service       │     │  Generation        │
│                │     │                │     │                    │
└────────────────┘     └────────────────┘     └────────────────────┘
```

### Publication Process:

1. **Flow Definition**: User creates a UPDL flow in the Flowise editor
2. **UPDL Conversion**: Flow is processed by the UPDL module to create standardized scene representation
3. **Export Request**: User initiates publication through the UI, selecting technology (e.g., AR.js)
4. **Export Processing**: The publish module calls appropriate exporter from the UPDL module
5. **Asset Generation**: HTML and required assets are generated (either client or server-side)
6. **Storage**: Generated assets are stored on the server with a unique UUID
7. **URL Generation**: A public URL is created and returned to the user (`/p/{uuid}`)
8. **Access**: End users can access the published content through the generated URL

## Exporters

Currently implemented exporters:

| Exporter ID | Target Platform | Description                         | Status               |
| ----------- | --------------- | ----------------------------------- | -------------------- |
| `arjs`      | AR.js           | Exports to web-based AR using AR.js | In development       |
| `html`      | Web/HTML        | Simple HTML preview of the scene    | Basic implementation |

Planned exporters (scheduled for Phase 3):

-   PlayCanvas (React & Engine) - Q2 2025
-   Three.js - Q2 2025
-   Babylon.js - Q3 2025
-   A-Frame - Q3 2025

## Interface Definitions

### PublisherProps

```ts
export interface PublisherProps {
    flowId: string // ID of the flow to publish
    onSuccess?: (result: PublishResult) => void // Success callback
    onError?: (error: PublishError) => void // Error callback
    initialOptions?: PublishOptions // Pre-filled options
}
```

### PublishResult

```ts
export interface PublishResult {
    uuid: string // Unique identifier for the published content
    publicUrl: string // Public-facing URL (/p/{uuid})
    embeddedUrl: string // Embedded URL (/e/p/{uuid})
    qrCodeUrl: string // URL to QR code image
    title: string // User-provided title
    exporterId: string // ID of the exporter used
    createdAt: string // ISO date string of creation time
    expiresAt?: string // Optional expiration date
}
```

### PublishOptions

```ts
export interface PublishOptions {
    title: string // Title for the published project
    description?: string // Optional description
    isPublic: boolean // Whether the content is publicly accessible
    expiresIn?: number // Optional TTL in days
    arjs?: {
        // AR.js specific options
        marker: string // Marker preset name or pattern file
        patternRatio?: number // Optional pattern ratio
    }
}
```

## Test Scenario

To validate the publication system, a standard test scenario uses the AR.js red cube example:

### AR.js Publication Test

1. **Create Test Flow**:

    - Create a new Flowise flow with UPDL nodes
    - Add Scene, Object (red cube), and Camera nodes
    - Configure the Object node with:
        - Type: Cube
        - Position: {x: 0, y: 0.5, z: 0}
        - Scale: {x: 1, y: 1, z: 1}
        - Material color: #FF0000 (red)
    - Save the flow

2. **Publish the Flow**:

    - Click the "Publish" button in the editor
    - Select "AR.js / A-Frame" as the technology
    - Enter "AR Test" as the title
    - Select "Hiro" marker preset
    - Click "Publish"

3. **Verify Results**:

    - Check that a success message appears with a public URL
    - Confirm the QR code is displayed
    - Copy the URL (format should be `/p/{uuid}`)

4. **Test Viewing**:

    - Open the URL in a browser
    - Present the Hiro marker to the camera
    - Verify that a red cube appears positioned above the marker
    - Check that the cube maintains position as the marker moves

5. **Test Embedding**:
    - Open the embedded URL (`/e/p/{uuid}`)
    - Confirm the content loads without Universo Platformo header/footer
    - Verify the marker detection and cube rendering work identically

### Expected HTML Output

The generated HTML should be functionally equivalent to:

```html
<!DOCTYPE html>
<html>
    <head>
        <title>AR Test - Universo Platformo</title>
        <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    </head>
    <body style="margin: 0; overflow: hidden;">
        <a-scene embedded arjs>
            <a-marker preset="hiro">
                <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>
    </body>
</html>
```

## Contributing

Contributions are welcome! To add new exporters or extend functionality:

1. Add or update backend routes and controller methods.
2. Create new React components under `miniapps/` for your technology.
3. Update `common/types.ts` and React interfaces to include new types.
4. Register new routes in `srv/routes/` and corresponding services in `services/api`.
5. Run `pnpm --filter publish lint` and `pnpm --filter publish build` to verify.

### Adding a New Exporter

1. Create a new directory in `miniapps/` for your technology
2. Create a component that implements the `MiniAppPublisherProps` interface
3. Add exporter-specific options to the `PublishOptions` interface in `common/types.ts`
4. Register the exporter in the UPDL module's exporter registry
5. Update `PublishController.ts` to support the new exporter type
6. Add any necessary server-side handlers for the technology

## Building and Development

From the repository root, you can:

```bash
# Install dependencies
pnpm install

# Build the publish module
pnpm build --filter publish
```

This will:

1. Compile TypeScript code from `base/` to `dist/`
2. Generate declaration files (.d.ts) and source maps (.js.map)
3. Run Gulp tasks to copy SVG icons from source to dist directory

For development with automatic rebuilding on changes:

```bash
pnpm --filter publish dev
```

Note: While the `dev` script watches TypeScript files for changes, it doesn't automatically copy SVG icons. If you add or modify SVG assets during development, run `pnpm build --filter publish` to ensure they're properly copied to the dist directory.

_Universo Platformo | Publish Module Documentation_
