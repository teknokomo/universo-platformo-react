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
├── uniks-frt/           # Workspace management frontend
│   └── base/            # Core workspace functionality
│       ├── src/         # Source code
│       │   ├── i18n/    # Internationalization
│       │   ├── pages/   # Page components (UnikList, UnikDetail, UnikDialog)
│       │   ├── menu-items/ # Menu configurations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       └── README.md
├── uniks-srv/           # Workspace management backend (workspace package)
│   └── base/            # Core workspace functionality
│       ├── src/         # Source code
│       │   ├── routes/  # Express routes for Uniks CRUD operations
│       │   ├── database/ # TypeORM entities and migrations
│       │   ├── types/   # TypeScript declarations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── profile-frt/         # User profile management frontend
│   └── base/            # Core profile functionality
│       ├── src/         # Source code
│       │   ├── i18n/    # Localization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       ├── README.md
│       └── README-RU.md
├── profile-srv/         # User profile management backend (workspace package)
│   └── base/            # Core profile functionality
│       ├── src/         # Source code
│       │   ├── i18n/    # Localization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       ├── README.md
│       └── README-RU.md
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
├── publish-srv/         # Publication system backend (workspace package)
│   └── base/            # Core backend functionality for publication
│       ├── src/         # Source code
│       │   ├── controllers/ # Express controllers
│       │   ├── services/    # Business logic (e.g., FlowDataService)
│       │   ├── routes/      # Asynchronous route factories
│       │   ├── types/       # Shared UPDL type definitions
│       │   └── index.ts     # Entry point for the package
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md            # This documentation
```

## Applications

### Uniks (Workspace Management)

The Uniks application provides workspace management functionality, allowing users to create, manage, and organize their workspaces. It consists of a frontend application and a backend workspace package.

#### Uniks Frontend (uniks-frt)

**Key Features:**

-   Workspace creation and management interface
-   User-friendly workspace listing and navigation
-   Workspace member management
-   Responsive design with Material-UI components
-   Internationalization support (English and Russian)

**Documentation:** See [apps/uniks-frt/base/README.md](./uniks-frt/base/README.md)

#### Uniks Server (uniks-srv)

This is a backend service, structured as a workspace package (`@universo/uniks-srv`), responsible for handling workspace data and operations.

**Key Features:**

-   Express routes for Uniks CRUD operations
-   TypeORM entities (`Unik`, `UserUnik`) for database management
-   PostgreSQL database migrations
-   Supabase integration for authentication
-   Nested route mounting for Flowise routes under `/:unikId` prefix

**Documentation:** See [apps/uniks-srv/base/README.md](./uniks-srv/base/README.md)

### UPDL (Universal Platform Definition Language)

The UPDL application provides a unified node system for describing 3D/AR/VR spaces that can be exported to multiple target platforms. It defines a standardized intermediate representation layer that abstracts away the specifics of different rendering engines.

#### UPDL (updl)

**Key Features:**

-   7 core high-level nodes for universal 3D/AR/VR scene description
-   Legacy nodes (Object, Camera, Light) for backward compatibility
-   Node definitions and icons
-   Pure Flowise integration
-   TypeScript interfaces

**Interface Architecture:**

-   **Core UPDL Interfaces** (`UPDLInterfaces.ts`): Complete ecosystem definitions for flows, graphs, and detailed node properties
-   **Integration Interfaces** (`Interface.UPDL.ts`): Simplified interfaces for backend/frontend integration via `@server/interface` alias

**Documentation:** See [apps/updl/base/README.md](./updl/base/README.md)

### Profile

The Profile application provides user profile management functionality. It consists of a frontend application and a backend workspace package.

#### Profile Frontend (profile-frt)

**Key Features:**

-   JWT token-based authentication with Supabase
-   Email and password update functionality
-   Mobile-friendly responsive design

**Documentation:** See [apps/profile-frt/base/README.md](./profile-frt/base/README.md)

#### Profile Server (profile-srv)

This is a backend service, structured as a workspace package (`@universo/profile-srv`), responsible for handling user profile data securely.

**Key Features:**

-   Secure endpoints for user data management.
-   Uses custom SQL functions with `SECURITY DEFINER` for safe data updates.
-   Asynchronous route initialization to prevent race conditions with the database connection.

**Documentation:** See [apps/profile-srv/base/README.md](./profile-srv/base/README.md)

### Publish

The Publish application provides mechanisms for exporting UPDL spaces to AR.js and publishing them with shareable URLs.

#### Publish Frontend (publish-frt)

The frontend application is responsible for the entire user-facing publication workflow, including the final conversion of data to viewable AR.js and PlayCanvas formats.

**Key Features:**

-   **Client-Side UPDL Processing**: Uses the `UPDLProcessor` class to convert raw `flowData` from the backend into valid AR.js and PlayCanvas experiences. All heavy processing is done on the client.
-   **Template-Based Builders**: Flexible builder system with `ARJSBuilder` and `PlayCanvasBuilder` supporting multiple templates (Quiz, MMOOMM).
-   **MMOOMM Space MMO Template**: Comprehensive space MMO environment with industrial laser mining, physics-based flight, and real-time inventory management.
-   **Advanced Game Mechanics**: Entity system with ships, asteroids, stations, gates, and networking capabilities.
-   **Supabase Integration**: Persists publication configurations.
-   **AR Quiz Support**: Educational quizzes with scoring and lead collection.

**Documentation:** See [apps/publish-frt/base/README.md](./publish-frt/base/README.md)

#### Publish Backend (publish-srv)

This is a backend service, refactored into a workspace package (`@universo/publish-srv`), with a single responsibility: serving data to the frontend.

**Key Features:**

-   **Workspace Package**: Provides shared types and services as `@universo/publish-srv`.
-   **Raw Data Provider**: Serves raw `flowData` from the database, delegating all UPDL processing to the frontend.
-   **Source of Truth for Types**: Exports all shared UPDL and publication-related TypeScript types.
-   **Asynchronous Route Initialization**: Prevents race conditions by initializing routes only after a database connection is established.

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
pnpm build --filter profile-frt
pnpm build --filter uniks-frt
pnpm build --filter updl

# Build specific backend application
pnpm build --filter publish-srv
pnpm build --filter profile-srv
pnpm build --filter uniks-srv
```

## Development

To run a specific application in development mode (watches for changes and rebuilds):

```bash
pnpm --filter publish-frt dev
pnpm --filter profile-frt dev
pnpm --filter uniks-frt dev
pnpm --filter publish-srv dev
pnpm --filter profile-srv dev
pnpm --filter uniks-srv dev
pnpm --filter updl dev
```

**Note about resources:** The `dev` scripts watch for TypeScript file changes but don't automatically copy SVG icons. If you add or modify SVG resources during development, run `pnpm build --filter <app>` to ensure they are properly copied to the dist directory.

---

_Universo Platformo | Apps Documentation_
