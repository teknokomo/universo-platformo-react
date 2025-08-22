# Publication System

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo React. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

The Publication System provides comprehensive mechanisms for exporting UPDL spaces to various platforms and sharing them with public URLs.

## System Overview

The Publication System consists of two main components working together to provide a complete content publishing solution:

-   **Frontend (publish-frt)**: Client-side processing, template builders, and user interface
-   **Backend (publish-srv)**: Data management, API endpoints, and type definitions

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Flowise       │───▶│   UPDL Nodes    │───▶│  Publication    │
│   Editor        │    │   (Flow Data)   │    │   System        │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │                 │
                                              │  Public URLs    │
                                              │  /p/{uuid}      │
                                              │                 │
                                              └─────────────────┘
```

## Frontend (publish-frt)

The frontend application provides the user interface for configuring and initiating the publication process. It acts as a consumer of template packages, such as `@universo/template-mmoomm`, to generate the final user experience.

### Key Features

-   **Publication UI**: Provides the user interface for selecting templates, configuring options, and managing public links.
-   **Template Consumer**: Dynamically loads and utilizes template packages to generate experiences.
-   **Modular Architecture**: Consumes dedicated template packages (e.g., `@universo/template-mmoomm`) for specific functionality.
-   **Supabase Integration**: Persists publication configurations.
-   **AR Quiz Support**: Educational quizzes with scoring and lead collection.

### Template Architecture

The builders system uses a **modular, template-based architecture** organized by template first, then by technology. The system now supports both internal templates and external template packages:

#### Internal Templates (Built-in)

```
builders/templates/
├── quiz/                    # Educational quiz template
│  └── arjs/                 # AR.js implementation
│     ├── ARJSBuilder.ts     # High-level controller
│     ├── ARJSQuizBuilder.ts # Template implementation
│     └── handlers/          # Quiz-specific processors
```

#### External Template Packages (Modular)

```
@universo/template-mmoomm/   # Dedicated MMOOMM template package
├── src/playcanvas/
│   ├── builders/            # Template builders
│   ├── handlers/            # Node handlers
│   ├── multiplayer/         # Colyseus multiplayer support
│   └── generators/          # Code generators
```

#### Integration Pattern

```typescript
// publish-frt consumes external template packages
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

export class PlayCanvasBuilder extends AbstractTemplateBuilder {
    async build(flowData: any, options: BuildOptions): Promise<string> {
        const mmoommBuilder = new PlayCanvasMMOOMMBuilder()
        return mmoommBuilder.build(flowData, options)
    }
}
```

### Supported Platforms

#### AR.js Export

-   **Marker-based AR**: Pattern, barcode, and NFT markers
-   **Library Configuration**: User-selectable library sources (CDN or local)
-   **Quiz Templates**: Educational content with scoring
-   **Mobile Optimization**: Responsive design for mobile devices

#### PlayCanvas Export

-   **3D Environments**: Full 3D scene rendering
-   **MMOOMM Template**: Space MMO with mining and trading
-   **Physics Integration**: Realistic physics simulation
-   **Entity Systems**: Complex game object management

### Critical Implementation: Iframe-Based Rendering

**IMPORTANT**: AR.js and PlayCanvas content must be rendered using iframe approach for proper library loading and script execution.

```typescript
// ✅ CORRECT: iframe approach (full script execution)
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(html) // Generated HTML with <script> tags
iframeDoc.close()
```

### Library Configuration System

User-selectable library sources solve CDN blocking issues:

**Library Sources:**

-   **Official CDN**: External CDN sources for global access
-   **Kiberplano Server**: Local server sources for restricted regions

**Configuration Storage:**

```json
{
    "arjs": {
        "libraryConfig": {
            "arjs": { "version": "3.4.7", "source": "kiberplano" },
            "aframe": { "version": "1.7.1", "source": "official" }
        }
    }
}
```

### AR.js Wallpaper Mode (Markerless)

-   New display option in AR.js exporter: `wallpaper` mode renders an animated wireframe background without `<a-marker>`.
-   UI: `AR Display Type` selector (default for new projects: wallpaper), `Wallpaper type` selector when wallpaper is chosen, marker controls hidden.
-   Builder: `ARJSQuizBuilder` renders a wireframe sphere with slower rotation (`dur: 90000`).
-   Persistence: `chatbotConfig.arjs` stores `arDisplayType` and `wallpaperType` along with `libraryConfig`.
-   Public API: the AR.js public endpoint returns optional `renderConfig` with the above fields; frontend falls back to marker mode if absent.

## Backend (publish-srv)

The backend service provides data management and API endpoints as a workspace package (`@universo/publish-srv`).

### Key Features

-   **Publication Management**: API endpoints to create and retrieve publication records
-   **Flow Data Provider**: Serves raw `flowData` from the database, delegating all UPDL processing to the frontend
-   **Centralized Types**: Exports shared UPDL and publication-related TypeScript types
-   **Modular and Decoupled**: Fully independent from `packages/server` business logic
-   **Asynchronous Route Initialization**: Prevents race conditions with database connections

### API Endpoints

#### Create Publication

```
POST /api/v1/publish/arjs
POST /api/v1/publish/playcanvas

Body: {
    "chatflowId": "uuid",
    "isPublic": true,
    "projectName": "My Experience",
    "libraryConfig": { ... }
}
```

#### Get Publication Data

```
GET /api/v1/publish/arjs/public/:publicationId
GET /api/v1/publish/playcanvas/public/:publicationId

Response: {
    "success": true,
    "flowData": "{\"nodes\":[...],\"edges\":[...]}",
    "libraryConfig": { ... }
}
```

### Workspace Package Architecture

The backend is implemented as a **pnpm workspace package**:

-   **Package Name**: `@universo/publish-srv`
-   **Integration**: Used as dependency in main server
-   **Exports**: Routes, types, services, controllers via `src/index.ts`
-   **Type Sharing**: Source of truth for UPDL types consumed by frontend

## UPDL Processing Architecture

The frontend includes independent UPDL processing capabilities through the `UPDLProcessor` class:

### Key Components

-   **UPDLProcessor**: Central class for UPDL flow processing
-   **Type Imports**: UPDL types imported from `@universo/publish-srv` package
-   **Frontend Independence**: Complete UPDL processing without backend dependencies

### Features

-   **Flow Analysis**: Identifies UPDL nodes and ending nodes
-   **Space Chain Processing**: Handles multi-space scenarios and scene sequences
-   **Data Integration**: Processes Data nodes connected to Spaces
-   **Object Relationships**: Maps Object nodes to Data nodes
-   **Type Safety**: Full TypeScript support with centralized type definitions

## Supabase Integration

Publication state persistence is handled through Supabase:

### Multi-Technology Structure

Settings stored in `chatbotConfig` field with structure:

```json
{
    "chatbot": { ... },
    "arjs": { ... },
    "playcanvas": { ... }
}
```

### Exclusive Publication Logic

The system ensures only one technology can be public at a time:

-   Independent publication states for each technology
-   Automatic disabling of other technologies when one is enabled
-   Global publication status management

## Workflow

The complete publication workflow:

1. **Settings Loading**: Automatically loaded from Supabase when component mounts
2. **Configuration**: User configures project parameters (title, marker, library sources)
3. **Publication**: User toggles "Make Public" - triggers publication and saves state
4. **API Request**: Frontend sends POST request to appropriate endpoint
5. **Public Access**: Public URL (`/p/{publicationId}`) renders appropriate viewer
6. **Data Retrieval**: Viewer makes GET request for flow data
7. **UPDL Processing**: `UPDLProcessor` analyzes and converts flow data
8. **Builder Generation**: Template builders convert UPDL space to target format
9. **Iframe Rendering**: Generated HTML rendered in iframe for proper execution

## MMOOMM Template Features

The MMOOMM (Massive Multiplayer Online Object Mining Management) template provides:

### Core Features

-   **Industrial Laser Mining System**: Auto-targeting laser mining with 3-second cycles
-   **Space Ship Controls**: WASD+QZ movement with physics-based flight mechanics
-   **Inventory Management**: 20m³ cargo hold with real-time capacity tracking
-   **Entity System**: Ships, asteroids, stations, and gates with networking capabilities
-   **Real-time HUD**: Mining progress, cargo status, and system indicators

### Game Mechanics

-   **Mining**: Target asteroids within 75-unit range, extract 1.5m³ resources per cycle
-   **Movement**: Full 6DOF ship movement with camera following
-   **Physics**: Collision detection, rigidbody dynamics, and realistic space physics

### Entity Types

-   **Ship**: Player-controlled spacecraft with laser mining system
-   **Asteroid**: Mineable objects with resource yield and destruction mechanics
-   **Station**: Trading posts and docking facilities for commerce
-   **Gate**: Teleportation portals for inter-system travel
-   **Player**: Network-aware player entities for multiplayer support

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build frontend
pnpm --filter publish-frt build

# Build backend
pnpm --filter @universo/publish-srv build
```

### Development Mode

```bash
# Frontend development
pnpm --filter publish-frt dev

# Backend development
pnpm --filter @universo/publish-srv dev
```

### Build Process

**Frontend:**

1. TypeScript compilation
2. Gulp tasks for static assets (SVG, PNG, JSON, CSS, JS libraries)

**Backend:**

1. TypeScript compilation
2. Type definitions generation

## Integration Points

### With Main Flowise Platform

-   **Route Integration**: Publication routes mounted in main server
-   **Authentication**: Uses shared JWT authentication system
-   **Database**: Accesses Flowise database via TypeORM DataSource

### With UPDL System

-   **Node Processing**: Converts UPDL nodes to platform-specific formats
-   **Type Definitions**: Shared interfaces for consistent data structures
-   **Template System**: Extensible architecture for new platforms

## Security Considerations

-   **Authentication**: JWT token validation for all operations
-   **Input Validation**: Comprehensive request validation
-   **Iframe Isolation**: Secure content rendering in isolated contexts
-   **CORS Configuration**: Proper cross-origin request handling

## Future Enhancements

-   **Additional Platforms**: Support for Three.js, Babylon.js, and other engines
-   **Real-time Collaboration**: Multi-user editing and publishing
-   **Version Control**: Publication versioning and rollback capabilities
-   **Analytics Integration**: Usage tracking and performance metrics
-   **CDN Integration**: Global content delivery optimization

## Next Steps

-   [UPDL System](../updl/README.md) - Learn about the Universal Platform Definition Language
-   [MMOOMM Templates](../../universo-platformo/mmoomm-templates/README.md) - Explore pre-built templates
-   [Multi-Platform Export](../../universo-platformo/export/README.md) - Export to different platforms
