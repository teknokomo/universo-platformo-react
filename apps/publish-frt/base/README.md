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
   │  ├─ images/           # Images for UI elements
   │  └─ libs/             # Local AR.js and A-Frame libraries for CDN-blocked regions
   │     ├─ aframe/        # A-Frame library versions
   │     │  └─ 1.7.1/      # A-Frame 1.7.1 files
   │     └─ arjs/          # AR.js library versions
   │        └─ 3.4.7/      # AR.js 3.4.7 files
   ├─ api/                 # HTTP clients for backend interaction
   │  ├─ common.ts         # Base API utilities (auth, URL parsing, base URL)
   │  ├─ index.ts          # Central API exports module
   │  └─ publication/      # Publication-specific API clients
   │     ├─ PublicationApi.ts        # Base publication API for all technologies
   │     ├─ ARJSPublicationApi.ts    # AR.js specific publication API
   │     ├─ StreamingPublicationApi.ts # Streaming publication API
   │     └─ index.ts       # Publication API exports with compatibility aliases
   ├─ builders/            # UPDL to target platform builders
   │  ├─ common/           # Shared builder infrastructure
   │  │  ├─ AbstractTemplateBuilder.ts # NEW: Abstract base class for all templates
   │  │  ├─ TemplateRegistry.ts       # NEW: Registry for managing templates
   │  │  ├─ UPDLProcessor.ts        # UPDL flow processing
   │  │  ├─ types.ts               # Common types and interfaces
   │  │  └─ setup.ts               # Builder and template registration setup
   │  ├─ arjs/             # AR.js specific builder
   │  │  ├─ ARJSBuilder.ts         # Main AR.js builder class (delegates to templates)
   │  │  └─ templates/             # NEW: Template-specific implementations
   │  │     └─ quiz/               # AR.js Quiz Template
   │  │        ├─ ARJSQuizBuilder.ts   # Builder for the quiz template
   │  │        ├─ handlers/            # Handlers specific to the quiz template
   │  │        │  ├─ ObjectHandler.ts
   │  │        │  └─ ... (other handlers)
   │  │        └─ index.ts
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

**Type System**: UPDL types are imported from `@universo/publish-srv` package, ensuring centralized type definitions and consistency across frontend and backend components.

## Critical Architecture: Iframe-Based AR.js Rendering

**IMPORTANT**: AR.js content must be rendered using iframe approach for proper library loading and script execution.

### Why Iframe is Essential

The AR.js libraries (A-Frame and AR.js) require proper script execution context that React's `dangerouslySetInnerHTML` cannot provide:

-   **Script Isolation**: Iframe creates isolated execution context for AR.js scripts
-   **Library Loading**: Enables proper loading of external/local JavaScript libraries
-   **Browser Compatibility**: Prevents conflicts with React's virtual DOM
-   **Security**: Isolates AR.js code from main application context

### Implementation Pattern (ARViewPage.tsx)

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
-   **`Handlers`**: Specialized processors for different UPDL node types (Space, Object, Camera, Light) are now encapsulated within each template (e.g., `apps/.../arjs/templates/quiz/handlers/`). This makes each template self-contained.

#### Features

-   **Maximum Extensibility**: Easy to add new target platforms (e.g., PlayCanvas) by creating a new template class that extends `AbstractTemplateBuilder`.
-   **Clear Separation of Concerns**: The high-level `ARJSBuilder` is simple and only manages the process, while templates contain all the specific implementation details.
-   **Self-Contained Templates**: Each template bundles its own logic, handlers, and required libraries, preventing conflicts.
-   **Type Safe**: Full TypeScript support with robust interfaces (`ITemplateBuilder`, `TemplateConfig`).
-   **Shared Functionality**: Common logic like library source resolution and HTML document wrapping is handled by the abstract base class, reducing code duplication.
-   **Future-Ready**: The architecture is prepared for `Universo MMOOMM` integration with a dedicated PlayCanvas template.

#### Usage

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

1. **Frontend Request**: User initiates publication through `ARJSPublisher` component
2. **API Call**: Frontend sends request to `/api/v1/publish/arjs` endpoint
3. **Backend Processing**: `FlowDataService` retrieves flow data from Flowise database
4. **Frontend Processing**: `UPDLProcessor` analyzes and converts flow data to UPDL structures
5. **Builder Generation**: **The `ARJSBuilder` delegates the build process to a registered template builder (e.g., `ARJSQuizBuilder`), which converts the UPDL space to A-Frame elements.**
6. **Result**: Generated content served through public URLs with iframe rendering

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
-   **Technology-Specific Configuration**: AR.js settings are stored in the `arjs` block within `chatbotConfig`, maintaining separation from chatbot settings
-   **API Route Consistency**: Uses the same Flowise API routes (`/api/v1/uniks/{unikId}/chatflows/{chatflowId}`) as the main system

### Supabase Integration

Publication state persistence is handled through Supabase integration:

-   **Multi-Technology Structure**: Settings stored in `chatbotConfig` field with structure `{"chatbot": {...}, "arjs": {...}}`
-   **Independent Publication States**: Each technology (chatbot, AR.js) has its own `isPublic` flag
-   **Auto-save Functionality**: Settings automatically saved when parameters change
-   **State Restoration**: Previous settings restored when component mounts
-   **Global Publication Status**: Overall `isPublic` flag set to true if any technology is public

## Main Components

-   `UPDLProcessor` - Central class for UPDL flow processing (migrated from backend)
-   `ARJSPublisher` - Component for AR.js project streaming publication with Supabase integration
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing using iframe approach
-   `ARJSBuilder` - **The high-level controller that delegates to the template system.**
-   `ARJSQuizBuilder` - **A concrete template implementation for AR.js quizzes.**
-   `PlayCanvasPublisher` - Component for PlayCanvas publication settings
-   `PlayCanvasBuilder` - Builder for PlayCanvas HTML output with template support

## API Architecture

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
6. When accessing the public URL (`/p/{publicationId}`), the `ARViewPage` component is rendered
7. The component makes a GET request to `/api/v1/publish/arjs/public/:publicationId`, which returns flow data from the backend
8. The `UPDLProcessor` analyzes the flow data and converts it to UPDL structures on the frontend
9. The `ARJSBuilder` system converts the UPDL space to A-Frame elements using the appropriate template
10. **Critical**: Generated HTML is rendered in iframe for proper script execution and library loading

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
