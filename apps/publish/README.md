# Publish Module

This application provides the publication system for Universo Platformo React. It enables exporting and publishing UPDL flows via a REST API and client-side React components, supporting AR.js markers, content embedding, and future extensions for additional rendering engines.

## Overview

-   **Purpose**: Offer a unified service and UI for publishing 3D/AR/VR scenes defined in UPDL.
-   **Capabilities**:
    -   REST endpoints to list exporters, publish flows, and retrieve marker information
    -   React UI components for embedding publication controls in applications
    -   Support for AR.js marker-based publishing and content hosting
    -   Extensible architecture for additional output formats (PlayCanvas, Babylon.js, Three.js)

## Current Status

-   **Development Phase**: Foundation Phase (Phase 1)
-   **Implementation Progress**:

    -   Core publication architecture - ✅ Complete
    -   Express API endpoints - ✅ Complete
    -   AR.js publication workflow - 🔄 In active development
    -   Publication UI components - 🔄 In progress
    -   QR code generation for mobile access - ⏳ Planned
    -   Other technology exporters - ⏳ Planned

-   **Current Sprint Focus**:

    -   Completing the publication UI according to design screenshots
    -   Testing full publication flow from editor to public URL
    -   Implementing the `/p/{uuid}` URL scheme for published content
    -   Creating test scenarios with the AR.js red cube example

-   **Pending Tasks**:
    -   Publication form UI refinement - In progress
    -   QR code implementation for mobile access - Planned
    -   Full end-to-end testing of publication workflow - In progress
    -   Integration with PlayCanvas and other targets - Planned for future sprints

## Installation

From the repository root, install dependencies and build the publish application:

```bash
pnpm install
pnpm build --filter publish
```

To start development mode for TypeScript watch:

```bash
pnpm --filter publish dev
```

## Usage

### REST API (Express Server)

Import and mount the router in your main server application:

```ts
import express from 'express'
import publishRoutes from '@apps/publish/imp/express/routes/publishRoutes'

const app = express()
app.use(express.json())
app.use('/api/v1/publish', publishRoutes)
app.listen(3000)
```

Available endpoints:

| Method | Path                           | Description                                             |
| ------ | ------------------------------ | ------------------------------------------------------- |
| GET    | `/api/v1/publish/exporters`    | List all available exporters                            |
| POST   | `/api/v1/publish`              | Publish a UPDL flow (body: flowId, exporterId, options) |
| GET    | `/api/v1/publish/arjs/markers` | Get supported AR.js marker presets                      |
| POST   | `/api/v1/publish/arjs`         | Dedicated endpoint for AR.js publication                |
| GET    | `/p/{uuid}`                    | Access published content with Universo Platformo header |
| GET    | `/e/p/{uuid}`                  | Access embedded (frameless) published content           |

### React Components

Use the `ARJSPublisher` component or programmatic services:

```tsx
import { ARJSPublisher } from '@apps/publish/imp/react/miniapps/arjs/ARJSPublisher'

// In JSX
;<ARJSPublisher flowId='abc123' />
```

Service functions:

```ts
import { getExporters, publishFlow, getARJSMarkers, publishARJSFlow } from '@apps/publish/imp/react/services/api'

const exporters = await getExporters()
const markers = await getARJSMarkers()
const result = await publishFlow(flowId, exporterId, options)
```

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

## File Structure

```
apps/publish/
├── package.json          # Application metadata and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # This documentation file
├── dist/                 # Compiled output
├── node_modules/         # Dependencies
└── imp/                  # Implementation source code
    ├── common/           # Shared types and utilities
    │   └── types.ts      # Type definitions for publish objects
    ├── express/          # Backend API server
    │   ├── server.ts     # Express server setup with routes and controllers
    │   ├── routes/       # Route definitions
    │   │   ├── publishRoutes.ts # Endpoints for publishing services
    │   │   └── updlRoutes.ts    # Optional UPDL-specific routes
    │   ├── controllers/  # Request handlers implementing business logic
    │   │   ├── PublishController.ts # Handles publishFlow, getExporters, getARJSMarkers
    │   │   └── UPDLController.ts    # Handles UPDL build endpoints
    │   └── layouts/      # HTML or template layouts (if applicable)
    │       ├── base.html     # Base HTML template with common structure
    │       └── embedded.html # Minimalist template for embedded content
    └── react/            # Frontend components and services
        ├── api/          # API client wrappers for publication endpoints
        │   ├── exporterApi.ts  # Functions to call /exporters endpoint
        │   └── updlApi.ts      # Functions to call UPDL-specific endpoints
        ├── components/   # Shared UI components for publish interface
        │   ├── PublishButton.tsx     # Button that triggers publication process
        │   ├── PublishDialog.tsx     # Main dialog for publication configuration
        │   ├── ExporterSelector.tsx  # UI for selecting target technology
        │   ├── PublishOptions.tsx    # Technology-specific options form
        │   ├── MarkerSelector.tsx    # Component for AR.js marker selection
        │   ├── SuccessDialog.tsx     # Result dialog with URL and QR code (in development)
        │   └── QRCode.tsx            # QR code generator for mobile access (planned)
        ├── interfaces/   # TypeScript interfaces for React props and results
        │   ├── PublisherProps.ts     # Props, result types, error structures
        │   └── PublishFormState.ts   # Form state for publication UI
        ├── miniapps/     # Technology-specific publisher components
        │   ├── arjs/     # AR.js publisher example (active development)
        │   │   ├── ARJSPublisher.tsx   # React component for AR.js publication UI
        │   │   └── arjsStyles.css      # Styles for AR.js publisher UI
        │   ├── aframe-vr/  # A-Frame VR publisher (planned for Phase 3)
        │   │   └── AFrameVRPublisher.tsx  # VR mode publisher without AR markers
        │   └── playcanvas-react/  # PlayCanvas React publisher (planned for Phase 3)
        │       └── PlayCanvasReactPublisher.tsx # Placeholder for future implementation
        ├── pages/        # High-level UI pages or views
        │   ├── PublishPage.tsx       # Standalone publication page
        │   └── PublishedViewPage.tsx # Page for viewing published content
        └── services/     # Programmatic publish functions
            └── api.ts   # Consolidated API service functions (getExporters, publishFlow)
```

## Key Files

### common/types.ts

Defines shared TypeScript types such as:

-   `PublishResult`: Contains successful publication details (uuid, urls, etc.)
-   `PublishError`: Structured error information for failed publications
-   `ExporterInfo`: Metadata about available exporters
-   `MarkerInfo`: Information about AR.js marker presets
-   `PublishOptions`: Configuration options for publication process

### express/server.ts

Initializes an Express instance, applies middleware, and mounts route handlers from `routes/`. Key features:

-   Serves static files from published content directory
-   Sets up CORS policies for API calls
-   Configures JSON body parsing
-   Registers routes from publishRoutes and updlRoutes

### controllers/PublishController.ts

Implements methods:

-   `getExporters(req, res)`: Returns metadata about available exporters
-   `publishFlow(req, res)`: Validates payload, invokes UPDL build/publish logic, and returns result
-   `getARJSMarkers(req, res)`: Returns list of AR.js marker presets (e.g., `hiro`, `kanji`)
-   `publishARJSFlow(req, res)`: AR.js specific publication endpoint with specialized validation

### controllers/UPDLController.ts

Handles UPDL-specific operations:

-   `buildUPDLFlow(req, res)`: Constructs a UPDL scene graph from a Flowise node graph
-   `validateUPDLFlow(req, res)`: Checks if a UPDL flow is valid for publication
-   `getPublishedProject(req, res)`: Retrieves a previously published project by UUID
-   `listPublishedProjects(req, res)`: Lists all published projects with optional filtering

### express/layouts/

Contains HTML templates for serving published content:

-   `base.html`: Full template with Universo Platformo header and footer
-   `embedded.html`: Minimalist template for embedding in third-party sites

### react/components/

Contains shared UI components for the publication interface:

-   `PublishButton.tsx`: Entry point component that triggers the publication dialog
-   `PublishDialog.tsx`: Main dialog for configuring publication options
-   `ExporterSelector.tsx`: Dropdown for selecting the target technology
-   `PublishOptions.tsx`: Dynamic form that changes based on selected exporter
-   `MarkerSelector.tsx`: Component for AR.js marker selection
-   `SuccessDialog.tsx`: Dialog showing the published URL with QR code (in development)
-   `QRCode.tsx`: Component for generating QR codes for mobile access (planned)

### react/miniapps/arjs/ARJSPublisher.tsx

A complete React component that provides a publication UI for AR.js:

-   Includes forms for title, description, and marker selection
-   Handles submission to the publication API
-   Displays success/error state and provides the public URL
-   Shows a QR code for mobile access (planned functionality)

### react/services/api.ts

Exports functions:

-   `getExporters()`: Fetches exporter list with metadata
-   `publishFlow(flowId, exporterId, options)`: Posts a publish request
-   `getARJSMarkers()`: Fetches available AR.js marker presets
-   `publishARJSFlow(flowId, options)`: Specialized function for AR.js publication

## Exporters

Currently implemented exporters:

| Exporter ID | Target Platform | Description                                 | Status               |
| ----------- | --------------- | ------------------------------------------- | -------------------- |
| `arjs`      | AR.js/A-Frame   | Exports to web-based AR using AR.js/A-Frame | In development       |
| `html`      | Web/HTML        | Simple HTML preview of the scene            | Basic implementation |

Planned exporters (scheduled for Phase 3):

-   PlayCanvas (React & Engine) - Q2 2025
-   Three.js - Q2 2025
-   Babylon.js - Q3 2025
-   A-Frame VR - Q3 2025

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
4. Register new routes in `express/routes/` and corresponding services in `react/api`.
5. Run `pnpm --filter publish lint` and `pnpm --filter publish build` to verify.

### Adding a New Exporter

1. Create a new directory in `react/miniapps/` for your technology
2. Create a component that implements the `MiniAppPublisherProps` interface
3. Add exporter-specific options to the `PublishOptions` interface in `common/types.ts`
4. Register the exporter in the UPDL module's exporter registry
5. Update `PublishController.ts` to support the new exporter type
6. Add any necessary server-side handlers for the technology

_Universo Platformo | Publish Module Documentation_
