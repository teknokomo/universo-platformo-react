# Publication Frontend (publish-frt)

Frontend for the publication system in Universo Platformo, supporting AR.js and PlayCanvas.

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
   │  ├─ images/           # Images for UI elements
   │  └─ libs/             # Local libraries for CDN-blocked regions
   │     ├─ aframe/        # A-Frame library versions
   │     └─ arjs/          # AR.js library versions
   ├─ api/                 # HTTP clients for backend interaction
   │  ├─ common.ts         # Base API utilities (auth, URL parsing, base URL)
   │  ├─ index.ts          # Central API exports module
   │  └─ publication/      # Publication-specific API clients
   │     ├─ PublicationApi.ts        # Base publication API for all technologies
   │     ├─ ARJSPublicationApi.ts    # AR.js specific publication API
   │     ├─ PlayCanvasPublicationApi.ts # PlayCanvas specific publication API
   │     ├─ StreamingPublicationApi.ts # Streaming publication API
   │     └─ index.ts       # Publication API exports with compatibility aliases
   ├─ builders/            # UPDL to target platform builders with template-first architecture
   │  ├─ common/           # Shared builder infrastructure
   │  │  ├─ AbstractTemplateBuilder.ts # Abstract base class for all templates
   │  │  ├─ BaseBuilder.ts           # Base builder class for high-level builders
   │  │  ├─ BuilderRegistry.ts       # Registry for managing high-level builders
   │  │  ├─ TemplateRegistry.ts      # Registry for managing template implementations
   │  │  ├─ UPDLProcessor.ts         # UPDL flow processing
   │  │  ├─ types.ts                 # Common types and interfaces
   │  │  └─ setup.ts                 # Builder and template registration setup
   │  ├─ templates/        # Template-first organization (NEW ARCHITECTURE)
   │  │  ├─ quiz/          # Quiz template for educational content
   │  │  │  └─ arjs/       # AR.js implementation of quiz template
   │  │  │     ├─ ARJSBuilder.ts         # High-level AR.js builder
   │  │  │     ├─ ARJSQuizBuilder.ts     # Quiz template implementation
   │  │  │     ├─ config.ts              # Quiz template configuration
   │  │  │     ├─ handlers/              # UPDL node processors for quiz
   │  │  │     │  ├─ ActionHandler.ts    # Action node processing
   │  │  │     │  ├─ CameraHandler.ts    # Camera node processing
   │  │  │     │  ├─ ComponentHandler.ts # Component node processing
   │  │  │     │  ├─ DataHandler.ts      # Data/Questions processing
   │  │  │     │  ├─ EntityHandler.ts    # Entity node processing
   │  │  │     │  ├─ EventHandler.ts     # Event node processing
   │  │  │     │  ├─ LightHandler.ts     # Light node processing
   │  │  │     │  ├─ ObjectHandler.ts    # Object node processing
   │  │  │     │  ├─ SpaceHandler.ts     # Space node processing
   │  │  │     │  ├─ UniversoHandler.ts  # Universo node processing
   │  │  │     │  └─ index.ts            # Handlers export
   │  │  │     ├─ utils/                 # Template-specific utilities
   │  │  │     │  └─ SimpleValidator.ts  # Validation utilities
   │  │  │     └─ index.ts               # Quiz AR.js exports
   │  │  └─ mmoomm/        # MMOOMM template for MMO gaming
   │  │     └─ playcanvas/ # PlayCanvas implementation of MMOOMM template
   │  │        ├─ PlayCanvasBuilder.ts       # High-level PlayCanvas builder
   │  │        ├─ PlayCanvasMMOOMMBuilder.ts # MMOOMM template implementation
   │  │        ├─ config.ts                  # MMOOMM template configuration
   │  │        ├─ handlers/                  # UPDL node processors for MMOOMM
   │  │        │  ├─ ActionHandler.ts        # Action node processing
   │  │        │  ├─ ComponentHandler.ts     # Component node processing
   │  │        │  ├─ DataHandler.ts          # Data node processing
   │  │        │  ├─ EntityHandler.ts        # Entity node processing
   │  │        │  ├─ EventHandler.ts         # Event node processing
   │  │        │  ├─ SpaceHandler.ts         # Space node processing
   │  │        │  ├─ UniversoHandler.ts      # Universo node processing
   │  │        │  └─ index.ts                # Handlers export
   │  │        ├─ scripts/                   # PlayCanvas scripts system
   │  │        │  ├─ BaseScript.ts           # Abstract base class for scripts
   │  │        │  ├─ RotatorScript.ts        # Rotation animation script
   │  │        │  └─ index.ts                # Scripts module exports
   │  │        └─ index.ts                   # MMOOMM PlayCanvas exports
   │  └─ index.ts          # Main builders export
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  ├─ arjs/             # AR.js components and logic
   │  └─ playcanvas/       # PlayCanvas components and logic
   ├─ pages/               # Page components
   │  ├─ public/           # Public pages (ARViewPage, PlayCanvasViewPage)
   │  └─ ...
   └─ index.ts             # Entry point
```

**Type System**: UPDL types are imported from `@universo/publish-srv` package, ensuring centralized type definitions and consistency across frontend and backend components.

## Critical Architecture: Iframe-Based AR.js Rendering

**IMPORTANT**: AR.js content must be rendered using iframe approach for proper library loading and script execution.

### Why Iframe is Essential

The AR.js libraries (A-Frame and AR.js) require proper script execution context that React's `dangerouslySetInnerHTML` cannot provide:

-   **Script Isolation**: Iframe creates isolated execution context for AR.js scripts
-   **Library Loading**: Enables proper loading of external/local JavaScript libraries
-   **Browser Compatibility**: Prevents conflicts with React's virtual DOM
-   **Security**: Isolates AR.js/PlayCanvas code from main application context

### Implementation Pattern (ARViewPage.tsx, PlayCanvasViewPage.tsx)

```typescript
// ❌ WRONG: dangerouslySetInnerHTML (scripts don't execute)
;<div dangerouslySetInnerHTML={{ __html: html }} />

// ✅ CORRECT: iframe approach (full script execution)
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(html) // AR.js HTML with <script> tags
iframeDoc.close()
```

### Static Libraries Integration

The frontend works with local AR.js libraries served directly by the main Flowise server:

#### Server Configuration (packages/server/src/index.ts)

```typescript
// Static assets served by main Flowise server
const publishFrtAssetsPath = path.join(__dirname, '../../../apps/publish-frt/base/dist/assets')
this.app.use('/assets', express.static(publishFrtAssetsPath))
```

#### Library Sources

-   **Local (Kiberplano)**: `/assets/libs/aframe/1.7.1/aframe.min.js` - served by main server
-   **Official (CDN)**: `https://aframe.io/releases/1.7.1/aframe.min.js` - external CDN

#### Benefits

-   **CDN Blocking Solution**: Local libraries work in restricted regions
-   **Single Server**: No separate static file server needed
-   **Performance**: Direct serving from main Flowise instance
-   **Maintenance**: Libraries bundled with frontend distribution

## Template-Based Builders Architecture

The builders system has been refactored into a **modular, template-based architecture**. This provides maximum flexibility and extensibility for converting UPDL spaces to different target platforms (AR.js, PlayCanvas, etc.).

#### Key Components

-   **`AbstractTemplateBuilder`**: A new abstract base class that all templates (e.g., for AR.js quizzes, PlayCanvas scenes) must extend. It provides common functionality like library management and document structure wrapping.
-   **`TemplateRegistry`**: A central registry for managing and creating instances of different template builders.
-   **`ARJSBuilder`**: The high-level builder that now acts as a controller. It identifies the required template and delegates the entire build process to the corresponding template builder from the registry.
-   **`ARJSQuizBuilder`**: A concrete implementation of a template for generating AR.js HTML quizzes. It contains its own set of `Handlers` to process different UPDL nodes.
-   **`PlayCanvasMMOOMMBuilder`**: A concrete implementation of a template for generating PlayCanvas MMOOMM scenes with MMO-specific functionality.
-   **`Handlers`**: Specialized processors for different UPDL node types are now encapsulated within each template (e.g., `builders/templates/quiz/arjs/handlers/`, `builders/templates/mmoomm/playcanvas/handlers/`). This makes each template self-contained.

#### Template-First Architecture

The new architecture organizes code by **template first, then by technology**:

```
builders/templates/
├─ quiz/                    # Educational quiz template
│  └─ arjs/                 # AR.js implementation
│     ├─ ARJSBuilder.ts     # High-level controller
│     ├─ ARJSQuizBuilder.ts # Template implementation
│     └─ handlers/          # Quiz-specific processors
└─ mmoomm/                  # MMO gaming template
   └─ playcanvas/           # PlayCanvas implementation
      ├─ PlayCanvasBuilder.ts       # High-level controller
      ├─ PlayCanvasMMOOMMBuilder.ts # Template implementation
      └─ handlers/                  # MMOOMM-specific processors
```

#### Features

-   **Maximum Extensibility**: Easy to add new target platforms (e.g., Three.js) by creating a new template implementation under existing template folders.
-   **Template Reusability**: The same template (e.g., `quiz`) can support multiple technologies (AR.js, PlayCanvas, etc.) with shared abstract logic.
-   **Clear Separation of Concerns**: High-level builders are simple controllers, while template implementations contain all specific logic.
-   **Self-Contained Templates**: Each template bundles its own logic, handlers, and required libraries, preventing conflicts.
-   **Type Safe**: Full TypeScript support with robust interfaces (`ITemplateBuilder`, `TemplateConfig`).
-   **Shared Functionality**: Common logic like library source resolution and HTML document wrapping is handled by the abstract base class, reducing code duplication.
-   **Future-Ready**: The architecture supports unlimited template and technology combinations.

#### Recent Improvements

-   **PlayCanvasViewPage Refactoring**: Migrated from direct `PlayCanvasMMOOMMBuilder` import to `TemplateRegistry` usage, enabling dynamic template selection via `config.templateId` parameter.
-   **ENABLE_BACKEND_FETCH Flag**: Added feature flag (default: false) for optional backend data fetching. When disabled, component expects data via props, improving security and reliability.
-   **Exclusive Publication Logic**: Fixed logic in `PublicationApi.savePublicationSettings()` to only affect supported technologies (`chatbot`, `arjs`, `playcanvas`) and prevent accidental modification of unrelated config properties.
-   **Localization Enhancement**: Added missing `publish.playcanvas.loading` translation keys for improved multilingual support.

#### AR.js Builder Usage

```typescript
import { ARJSBuilder } from './builders'

const builder = new ARJSBuilder()

// Build using the default 'quiz' template
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'My AR Experience',
    markerType: 'preset',
    markerValue: 'hiro',
    libraryConfig: {
        arjs: { version: '3.4.7', source: 'kiberplano' },
        aframe: { version: '1.7.1', source: 'official' }
    }
})

// Or specify a different template if available
const anotherResult = await builder.buildFromFlowData(flowDataString, {
    templateId: 'another-template'
    // ... other options
})

console.log(result.html) // Generated AR.js HTML
console.log(result.metadata) // Build metadata
```

### PlayCanvas Builder Usage

```typescript
import { PlayCanvasBuilder } from './builders'

const builder = new PlayCanvasBuilder()
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'MMOOMM Demo',
    templateId: 'mmoomm'
})

console.log(result.html) // PlayCanvas HTML
```

### PlayCanvas Scripts System

The MMOOMM template includes a simple scripts system for reusable PlayCanvas behaviors:

```typescript
import { RotatorScript, getDefaultRotatorScript } from './scripts'

// Create a rotation script
const rotator = RotatorScript.createDefault()

// Get default rotator for demo mode
const defaultRotator = getDefaultRotatorScript()
```

#### Key Features

-   **Simple Architecture**: Clean, minimal implementation for MVP
-   **Type Safety**: Full TypeScript support
-   **Modular Design**: Scripts organized as separate modules
-   **Demo Integration**: Provides smooth animations for demo modes

#### Built-in Scripts

-   **RotatorScript**: Simple Y-axis rotation animation for demo cube

The scripts system provides smooth rotation animation for the default red cube in demo mode, extracted from the main builder for better code organization.

### Universo MMOOMM Example

The `mmoomm` template produces a small demo scene with a ship, asteroids and a gate.
Select **PlayCanvas MMOOMM Template** in the configuration or pass `templateId: 'mmoomm'` when using the builder.
Publish the project and open the public link to explore the prototype MMO environment.

## UPDL Processing Architecture

The frontend now includes independent UPDL processing capabilities through the `UPDLProcessor` class, eliminating dependencies on backend utilities.

### Key Components

-   **UPDLProcessor**: Central class for UPDL flow processing (migrated from `packages/server/src/utils/buildUPDLflow.ts`)
-   **Type Imports**: UPDL types imported from `@universo/publish-srv` package
-   **Frontend Independence**: Complete UPDL processing on frontend without backend dependencies

### Features

-   **Flow Analysis**: Identifies UPDL nodes and ending nodes
-   **Space Chain Processing**: Handles multi-space scenarios and scene sequences
-   **Data Integration**: Processes Data nodes connected to Spaces
-   **Object Relationships**: Maps Object nodes to Data nodes
-   **Type Safety**: Full TypeScript support with centralized type definitions

### Usage

```typescript
import { UPDLProcessor } from './builders/common/UPDLProcessor'
import { IUPDLSpace, IUPDLMultiScene } from '@universo/publish-srv'

const result = UPDLProcessor.processFlowData(flowDataString)
if (result.multiScene) {
    // Handle multi-space scenario
} else if (result.updlSpace) {
    // Handle single space scenario
}
```

## Library Configuration System

User-selectable library sources for AR.js and A-Frame to solve CDN blocking issues.

### How It Works

Users can choose library sources through the UI:

1. **AR.js Configuration**:

    - Version: Currently supports 3.4.7
    - Source: "Официальный сервер" (CDN) or "Сервер Kiberplano" (local)

2. **A-Frame Configuration**:
    - Version: Currently supports 1.7.1
    - Source: "Официальный сервер" (CDN) or "Сервер Kiberplano" (local)

### Library Sources

-   **Официальный сервер**: External CDN sources

    -   A-Frame: `https://aframe.io/releases/1.7.1/aframe.min.js`
    -   AR.js: `https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js`

-   **Сервер Kiberplano**: Local server (solves CDN blocking)
    -   A-Frame: `/assets/libs/aframe/1.7.1/aframe.min.js`
    -   AR.js: `/assets/libs/arjs/3.4.7/aframe-ar.js`

### Configuration Storage

Library preferences are stored in Supabase `chatbotConfig.arjs.libraryConfig`:

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

### Benefits

-   **Solves CDN Blocking**: Users in restricted regions can use local libraries
-   **User Choice**: Each user decides their preferred library source
-   **Persistent Settings**: Configuration saved per chatflow
-   **Backward Compatibility**: Existing flows continue working with defaults
-   **Future Extensibility**: Easy to add new library versions

## Backend Integration

The application maintains modular architecture with clean separation between frontend and backend components.

### Current Architecture

-   **Frontend Processing**: UPDL flow processing handled by `UPDLProcessor` class in frontend
-   **API Communication**: Backend interaction exclusively through REST API using clients from `api/` directory
-   **Type Sharing**: UPDL types centralized in `@universo/publish-srv` package and imported by frontend
-   **Service Layer**: Backend provides `FlowDataService` for flow data management
-   **Independence**: No direct imports from `packages/server` - complete modular independence

### Flow Processing Workflow

1. **Frontend Request**: User initiates publication through `ARJSPublisher` or `PlayCanvasPublisher` component.
2. **API Call**: Frontend sends request to `/api/v1/publish/arjs` (or other tech-specific endpoint).
3. **Backend Processing**: `FlowDataService` retrieves flow data from Flowise database.
4. **Frontend Processing**: `UPDLProcessor` analyzes and converts flow data to UPDL structures.
5. **Builder Generation**: The high-level builder (`ARJSBuilder`, `PlayCanvasBuilder`) delegates the build process to a registered template builder (e.g., `ARJSQuizBuilder`, `PlayCanvasMMOOMMBuilder`), which converts the UPDL space to the target format.
6. **Result**: Generated content served through public URLs with iframe rendering.

### Migration Benefits

-   **Performance**: Frontend processing reduces backend load
-   **Modularity**: Clear separation of concerns between frontend and backend
-   **Type Safety**: Centralized type definitions prevent inconsistencies
-   **Scalability**: Frontend can handle complex UPDL processing independently
-   **Maintenance**: Simplified architecture with fewer cross-package dependencies

### Integration with Bots System

This frontend application is closely integrated with the main bots publication system located in `packages/ui/src/views/publish/bots/`:

-   **Configuration Integration**: The AR.js publisher is accessible through the main publication interface in the bots system
-   **Shared Publication State**: Publication settings are stored in Supabase using the same `chatbotConfig` structure as the main bots system
-   **Technology-Specific Configuration**: AR.js and PlayCanvas settings are stored in their respective blocks (`arjs`, `playcanvas`) within `chatbotConfig`, maintaining separation from chatbot settings.
-   **API Route Consistency**: Uses the same Flowise API routes (`/api/v1/uniks/{unikId}/chatflows/{chatflowId}`) as the main system

### Supabase Integration

Publication state persistence is handled through Supabase integration:

-   **Multi-Technology Structure**: Settings stored in `chatbotConfig` field with structure `{"chatbot": {...}, "arjs": {...}, "playcanvas": {...}}`
-   **Independent Publication States**: Each technology (chatbot, AR.js, PlayCanvas) has its own `isPublic` flag.
-   **Exclusive Publication**: The system ensures only one technology can be public at a time. If one is enabled, all others are automatically disabled.
-   **Auto-save Functionality**: Settings automatically saved when parameters change
-   **State Restoration**: Previous settings restored when component mounts
-   **Global Publication Status**: Overall `isPublic` flag set to true if any technology is public

#### Exclusive Publication Logic

The system implements exclusive publication: only one technology can be public at a time.
When enabling publication for one technology (AR.js, PlayCanvas, Chatbot),
all other technologies are automatically disabled. This ensures clear content delivery
and prevents conflicts between different publication modes.

## Main Components

-   `UPDLProcessor` - Central class for UPDL flow processing (migrated from backend)
-   `ARJSPublisher` - Component for AR.js project streaming publication with Supabase integration
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing using iframe approach
-   `ARJSBuilder` - The high-level controller that delegates to the template system.
-   `ARJSQuizBuilder` - A concrete template implementation for AR.js quizzes.
-   `PlayCanvasPublisher` - Component for PlayCanvas publication settings.
-   `PlayCanvasBuilder` - Builder for PlayCanvas HTML output with template support.
-   `PlayCanvasViewPage` - Page component for viewing PlayCanvas scenes.
-   `PlayCanvasMMOOMMBuilder` - A concrete template implementation for the Universo MMOOMM project.
-   `PlayCanvas Scripts System` - Simple system for reusable PlayCanvas behaviors:
    -   `BaseScript` - Abstract base class for PlayCanvas scripts
    -   `RotatorScript` - Simple Y-axis rotation animation script

## API Architecture

The application uses a modular API architecture organized into layers:

#### Core API Utilities (`api/common.ts`)

-   `getAuthHeaders()` - Authentication token management from localStorage
-   `getCurrentUrlIds()` - Extract unikId and chatflowId from URL
-   `getApiBaseUrl()` - Dynamic API base URL resolution

#### Publication API Layer (`api/publication/`)

-   **`PublicationApi`** - Base class for publication functionality across all technologies. Manages multi-technology settings in `chatbotConfig`.
-   **`ARJSPublicationApi`** - AR.js specific publication settings management (extends PublicationApi)
-   **`PlayCanvasPublicationApi`** - PlayCanvas specific publication settings management (extends PublicationApi)
-   **`StreamingPublicationApi`** - Real-time content generation and streaming publication

#### API Integration Features

-   **Multi-Technology Support**: Publication API designed to support AR.js, PlayCanvas, Chatbot, and future technologies
-   **Supabase Integration**: Persistent storage using `chatbotConfig` structure with technology-specific blocks
-   **Backward Compatibility**: Includes compatibility aliases (`ChatflowsApi`, `ARJSPublishApi`) for seamless migration
-   **Proper Authentication**: Uses correct Flowise routes with `unikId` and `x-request-from: internal` headers
-   **Circular Dependency Prevention**: Clean architecture with `common.ts` utilities to prevent import cycles

## Creating AR.js Quizzes with UPDL

AR quizzes are built using a chain of UPDL **Space** nodes. Each space may include **Data** nodes with questions. A question can have multiple **Data** answer nodes connected to it. Correct answers are marked with `isCorrect`, and answer nodes can also define `enablePoints` and `pointsValue` for the scoring system. Each answer node may be linked to an **Object** node that appears when the answer is selected.

Spaces can form a sequence via their `nextSpace` connection to create multi‑question quizzes. A space with no Data nodes can collect user info (`collectName`, `collectEmail`, `collectPhone`) and save it to Supabase leads. The final space in a chain can enable `showPoints` to display the participant score. Currently this score is stored in the `lead.phone` field as a temporary solution.

## Workflow

The implementation uses streaming generation for AR.js from UPDL nodes with persistent configuration:

1. Settings are automatically loaded from Supabase when component mounts
2. User configures project parameters (title, marker, library sources) - settings auto-saved
3. User toggles "Make Public" - triggers publication and saves state to Supabase
4. The `ARJSPublisher` component sends a POST request to `/api/v1/publish/arjs` with the `chatflowId` and selected options
5. The backend `PublishController.publishARJS` handler returns a response with `publicationId` and publication metadata
6. When accessing the public URL (`/p/{publicationId}`), the `PublicFlowView` component is rendered, which then determines the technology and renders the appropriate viewer (`ARViewPage` or `PlayCanvasViewPage`).
7. The page component makes a GET request to `/api/v1/publish/arjs/public/:publicationId` (or similar for other techs), which returns flow data from the backend.
8. The `UPDLProcessor` analyzes the flow data and converts it to UPDL structures on the frontend.
9. The appropriate Builder system (`ARJSBuilder`, `PlayCanvasBuilder`) converts the UPDL space to renderable elements using the correct template.
10. **Critical**: Generated HTML is rendered in an iframe for proper script execution and library loading.

## Setup and Development

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
2. **Gulp Tasks**: Copies static assets (SVG, PNG, JSON, CSS, JS libraries) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (SVG, PNG, JPG, JSON, CSS, JS) from the source directories to the dist folder, preserving the directory structure. This ensures that assets and local libraries are available at runtime.

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
5. **For AR.js content**: Always use iframe approach for proper script execution

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
-   The Export tab is a demo only, without full HTML/ZIP export functionality

---

_Universo Platformo | Publication Frontend Module_
