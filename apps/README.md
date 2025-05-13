# Universo Platformo Apps Directory

This directory contains modular applications that extend the core Flowise platform, providing additional functionality without modifying the core codebase.

## Directory Structure

```
apps/
├── publish-frt/         # Publication system frontend for exporting and sharing content
│   ├── base/            # Core frontend functionality for publishing
│   │   ├── src/         # Source code
│   │   │   ├── assets/  # Static assets (icons, images)
│   │   │   ├── api/     # HTTP clients to backend
│   │   │   ├── components/ # React components
│   │   │   ├── features/   # Feature modules for different technologies
│   │   │   ├── hooks/   # Custom React hooks
│   │   │   ├── store/   # State management
│   │   │   ├── i18n/    # Localization
│   │   │   ├── utils/   # Utility functions
│   │   │   ├── interfaces/ # TypeScript types
│   │   │   ├── configs/ # Configuration
│   │   │   └── index.ts # Entry point
│   │   ├── dist/        # Compiled output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── gulpfile.ts
│   │   └── README.md
├── publish-srv/         # Publication system backend
│   ├── base/            # Core backend functionality for publishing
│   │   ├── src/         # Source code
│   │   │   ├── controllers/ # Express controllers
│   │   │   ├── routes/  # REST API routes
│   │   │   ├── services/ # Business logic
│   │   │   ├── models/  # Data models
│   │   │   ├── interfaces/ # TypeScript types
│   │   │   ├── utils/   # Helper functions
│   │   │   ├── configs/ # Configuration
│   │   │   ├── middlewares/ # Middleware handlers
│   │   │   ├── validators/ # Input validation
│   │   │   └── index.ts # Entry point
│   │   ├── dist/        # Compiled output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
├── updl-frt/            # Universal Platform Definition Language frontend
│   ├── base/            # Core frontend UPDL functionality
│   │   ├── src/         # Source code
│   │   │   ├── api/     # API clients
│   │   │   ├── assets/  # Static assets
│   │   │   ├── builders/ # Scene builder classes
│   │   │   ├── components/ # React components
│   │   │   ├── configs/ # Configuration
│   │   │   ├── features/ # Feature modules
│   │   │   ├── hooks/   # React hooks
│   │   │   ├── i18n/    # Internationalization
│   │   │   ├── interfaces/ # TypeScript types
│   │   │   ├── nodes/   # UPDL node definitions
│   │   │   ├── store/   # State management
│   │   │   ├── utils/   # Utility functions
│   │   │   └── index.ts # Entry point
│   │   ├── dist/        # Compiled output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── gulpfile.ts
│   │   └── README.md
├── updl-srv/            # Universal Platform Definition Language backend
│   ├── base/            # Core backend UPDL functionality
│   │   ├── src/         # Source code
│   │   │   ├── api/     # Legacy API endpoints
│   │   │   ├── configs/ # Configuration
│   │   │   ├── controllers/ # Express controllers
│   │   │   ├── interfaces/ # TypeScript types
│   │   │   ├── middlewares/ # Middleware handlers
│   │   │   ├── models/  # Data models
│   │   │   ├── routes/  # Route configuration
│   │   │   ├── services/ # Business logic
│   │   │   │   └── exporters/ # Platform exporters
│   │   │   ├── utils/   # Helper functions
│   │   │   ├── validators/ # Input validation
│   │   │   └── index.ts # Entry point
│   │   ├── dist/        # Compiled output
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
└── README.md            # This documentation
```

## Applications

### UPDL (Universal Platform Definition Language)

The UPDL application provides a unified node-based system for describing 3D/AR/VR scenes that can be exported to multiple target platforms. It defines a standardized intermediate representation layer that abstracts away the specifics of various rendering engines.

#### UPDL Frontend (updl-frt)

**Key Features:**

-   Universal node system (Scene, Object, Camera, Light, etc.)
-   Node definitions and icons
-   Scene builder utilities
-   Client-side APIs

**Documentation:** See [apps/updl-frt/base/README.md](./updl-frt/base/README.md)

#### UPDL Backend (updl-srv)

**Key Features:**

-   Exporters implementation
-   Server-side API endpoints
-   Conversion utilities

**Documentation:** See [apps/updl-srv/base/README.md](./updl-srv/base/README.md)

### Publish

The Publish application provides mechanisms for exporting UPDL scenes to various target platforms and publishing them with shareable URLs.

#### Publish Frontend (publish-frt)

**Key Features:**

-   Publication UI components
-   Technology selection interface
-   QR code generation for mobile access
-   Export functionality

**Documentation:** See [apps/publish-frt/base/README.md](./publish-frt/base/README.md)

#### Publish Backend (publish-srv)

**Key Features:**

-   URL-based sharing system
-   Publication storage
-   Server-side API endpoints
-   Project management

**Documentation:** See [apps/publish-srv/base/README.md](./publish-srv/base/README.md)

## Interactions

The apps in this directory are designed to work together in a modular architecture:

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Flowise    │──────▶│  UPDL Module   │───────▶│ Publish Module │
│   Editor     │       │  (Scene Graph) │        │  (Export/Share)│
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

In the new architecture:

```
┌──────────────┐
│              │
│   Flowise    │
│   Editor     │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌────────────────┐
│              │       │                │
│  UPDL-FRT    │──────▶│   UPDL-SRV     │
│  Frontend    │       │   Backend      │
│              │       │                │
└──────┬───────┘       └────────────────┘
       │
       ▼
┌──────────────┐       ┌────────────────┐       ┌────────────────┐
│              │       │                │       │                │
│ PUBLISH-FRT  │──────▶│  PUBLISH-SRV   │──────▶│  Public URL    │
│ Frontend     │       │  Backend       │       │  /p/{uuid}     │
│              │       │                │       │                │
└──────────────┘       └────────────────┘       └────────────────┘
```

## Development Guidelines

1. **Modularity:** Keep each app self-contained with clear interfaces
2. **Minimal Core Changes:** Avoid modifying core Flowise code
3. **Documentation:** Maintain README files in each app directory
4. **Shared Types:** Use common type definitions for cross-app communication

## Building

From the project root:

```bash
# Install all dependencies for the workspace
pnpm install

# Build all apps (and other packages in the workspace)
pnpm build

# Build specific app frontend
pnpm build --filter publish-frt
pnpm build --filter updl-frt

# Build specific app backend
pnpm build --filter publish-srv
pnpm build --filter updl-srv
```

## Development

To run a specific app in development mode (watches for changes and rebuilds):

```bash
pnpm --filter publish-frt dev
pnpm --filter publish-srv dev
pnpm --filter updl-frt dev
pnpm --filter updl-srv dev
```

**Note about assets:** The `dev` scripts watch TypeScript files for changes but don't automatically copy SVG icons. If you add or modify SVG assets during development, run `pnpm build --filter <app>` to ensure they're properly copied to the dist directory.

---

_Universo Platformo | Apps Documentation_
