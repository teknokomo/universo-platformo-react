# Universo Platformo Apps Directory

This directory contains modular applications that extend the main Flowise platform, providing additional functionality without modifying the core codebase.

## Current Structure

```
apps/
├── updl/                # UPDL node system for creating universal 3D/AR/VR spaces
│   └── base/            # Core UPDL functionality
│       ├── src/         # Source code
│       │   ├── assets/  # Static resources (icons, images)
│       │   ├── i18n/    # Internationalization
│       │   ├── interfaces/ # TypeScript types
│       │   ├── nodes/   # UPDL node definitions
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       └── README.md
├── publish-frt/         # Publication system frontend for exporting and sharing content
│   └── base/            # Core frontend functionality for publication
│       ├── src/         # Source code
│       │   ├── api/     # HTTP clients to backend
│       │   │   ├── common.ts          # Core API utilities
│       │   │   ├── index.ts           # Central API exports
│       │   │   └── publication/       # Publication-specific API clients
│       │   │       ├── PublicationApi.ts        # Base publication API
│       │   │       ├── ARJSPublicationApi.ts    # AR.js specific API
│       │   │       ├── StreamingPublicationApi.ts # Streaming API
│       │   │       └── index.ts       # Publication exports with compatibility
│       │   ├── assets/  # Static resources (icons, images)
│       │   ├── components/ # React components
│       │   ├── features/   # Feature modules for various technologies
│       │   ├── i18n/    # Localization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       └── README.md
├── publish-srv/         # Publication system backend
│   └── base/            # Core backend functionality for publication
│       ├── src/         # Source code
│       │   ├── controllers/ # Express controllers
│       │   ├── routes/  # REST API routes
│       │   ├── utils/   # Helper functions
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md            # This documentation
```

## Applications

### UPDL (Universal Platform Definition Language)

The UPDL application provides a unified node system for describing 3D/AR/VR spaces that can be exported to multiple target platforms. It defines a standardized intermediate representation layer that abstracts away the specifics of different rendering engines.

#### UPDL (updl)

**Key Features:**

-   Universal node system (Space, Object, Camera, Light, etc.)
-   Node definitions and icons
-   Pure Flowise integration
-   TypeScript interfaces

**Interface Architecture:**

-   **Core UPDL Interfaces** (`UPDLInterfaces.ts`): Complete ecosystem definitions for flows, graphs, and detailed node properties
-   **Integration Interfaces** (`Interface.UPDL.ts`): Simplified interfaces for backend/frontend integration via `@server/interface` alias

**Documentation:** See [apps/updl/base/README.md](./updl/base/README.md)

### Publish

The Publish application provides mechanisms for exporting UPDL spaces to various target platforms and publishing them with shareable URLs.

#### Publish Frontend (publish-frt)

**Key Features:**

-   Modular API architecture with technology-specific clients
-   Multi-technology publication support (AR.js, Chatbot, extensible to others)
-   **Multi-Object UPDL Support**: Handles multiple objects with automatic circular positioning
-   Supabase integration with persistent configuration storage
-   Publication UI components with real-time streaming generation
-   Technology selection interface with independent publication states
-   QR code generation for mobile access
-   Export functionality with backward compatibility
-   Circular dependency prevention and clean code architecture
-   **Advanced Object Validation**: Built-in validation and cleanup for UPDL data integrity

**Documentation:** See [apps/publish-frt/base/README.md](./publish-frt/base/README.md)

#### Publish Backend (publish-srv)

**Key Features:**

-   URL-based sharing system
-   Publication storage
-   Server-side API endpoints
-   Project management

**Documentation:** See [apps/publish-srv/base/README.md](./publish-srv/base/README.md)

## Architecture for Future Expansion

When expanding application functionality, you can create additional directories following this structure:

```
app-name/
├── base/                # Core functionality
│   ├── src/             # Source code
│   │   ├── api/         # API clients (for frontend)
│   │   ├── assets/      # Static resources (icons, images)
│   │   ├── builders/    # UPDL to target platform builders (for frontend)
│   │   ├── components/  # React components (for frontend)
│   │   ├── configs/     # Configuration constants
│   │   ├── controllers/ # Express controllers (for backend)
│   │   ├── features/    # Feature modules (former mini-apps)
│   │   ├── hooks/       # React hooks (for frontend)
│   │   ├── i18n/        # Internationalization resources
│   │   ├── interfaces/  # TypeScript interfaces and types
│   │   ├── middlewares/ # Middleware handlers (for backend)
│   │   ├── models/      # Data models (for backend)
│   │   ├── nodes/       # UPDL node definitions
│   │   ├── routes/      # REST API routes (for backend)
│   │   ├── services/    # Business logic (for backend)
│   │   ├── store/       # State management (for frontend)
│   │   ├── utils/       # Utilities
│   │   ├── validators/  # Input validation (for backend)
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   ├── gulpfile.ts      # (for frontend modules with assets)
│   └── README.md
```

**Note:** Not all directories are required for every application. Create only the directories that are needed for your specific functionality:

-   **Frontend applications** typically need: `api/`, `assets/`, `components/`, `features/`, `pages/`, `utils/`, `gulpfile.ts`
-   **Backend applications** typically need: `controllers/`, `routes/`, `utils/`
-   **UPDL modules** typically need: `assets/`, `interfaces/`, `nodes/`, `gulpfile.ts`

## Interactions

The applications in this directory are designed to work together in a modular architecture:

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Flowise    │──────▶│  UPDL Module   │───────▶│ Publish Module │
│   Editor     │       │  (Space Graph) │        │  (Export/Share)│
│              │       │                │        │                │
└──────────────┘       └────────────────┘        └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

In the current architecture:

```
┌──────────────┐
│              │
│   Flowise    │
│   Editor     │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌────────────────┐       ┌────────────────┐
│              │       │                │       │                │
│     UPDL     │──────▶│ PUBLISH-FRT    │──────▶│  PUBLISH-SRV   │
│   (Nodes)    │       │   Frontend     │       │    Backend     │
│              │       │                │       │                │
└──────────────┘       └────────────────┘       └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

## Development Guidelines

1. **Modularity:** Keep each application self-contained with clear interfaces
2. **Minimal Core Changes:** Avoid modifying the main Flowise codebase
3. **Documentation:** Maintain README files in each application directory
4. **Shared Types:** Use common type definitions for inter-application communication

## Building

From the project root:

```bash
# Install all dependencies for workspace
pnpm install

# Build all applications (and other packages in workspace)
pnpm build

# Build specific frontend application
pnpm build --filter publish-frt
pnpm build --filter updl

# Build specific backend application
pnpm build --filter publish-srv
```

## Development

To run a specific application in development mode (watches for changes and rebuilds):

```bash
pnpm --filter publish-frt dev
pnpm --filter publish-srv dev
pnpm --filter updl dev
```

**Note about resources:** The `dev` scripts watch for TypeScript file changes but don't automatically copy SVG icons. If you add or modify SVG resources during development, run `pnpm build --filter <app>` to ensure they are properly copied to the dist directory.

---

_Universo Platformo | Apps Documentation_
