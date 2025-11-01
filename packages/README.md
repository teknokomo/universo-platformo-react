# Universo Platformo Apps Directory

This directory contains modular applications that extend the main Flowise platform, providing additional functionality without modifying the core codebase.

## Current Structure

```
packages/
├── analytics-frt/       # Quiz analytics frontend
│   └── base/            # Core analytics functionality
│       ├── src/         # Source code
│       │   ├── components/ # Analytics UI components
│       │   ├── i18n/    # Internationalization
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-frt/            # Authentication UI primitives
│   └── base/            # Core auth UI functionality
│       ├── src/         # Source code
│       │   ├── components/ # Auth components (LoginForm, SessionGuard)
│       │   ├── hooks/   # React hooks for auth
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-srv/            # Passport.js + Supabase session backend
│   └── base/            # Core auth backend functionality
│       ├── src/         # Source code
│       │   ├── middleware/ # Passport strategies and session handlers
│       │   ├── routes/  # Auth routes (login, logout, session)
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-chatmessage/ # Chat message components
│   └── base/            # Reusable chat interface components
│       ├── src/         # Source code
│       │   ├── components/ # 7 chat components (ChatPopUp, ChatMessage, etc.)
│       │   ├── styles/  # Component styles
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-components/  # Core Flowise node components
│   ├── src/             # Source code
│   │   ├── nodes/       # Node implementations
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── flowise-server/      # Backend server
│   ├── src/             # Source code
│   │   ├── database/    # TypeORM entities and migrations
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── flowise-store/       # Shared Redux store
│   └── base/            # Redux store configuration
│       ├── src/         # Source code
│       │   ├── slices/  # Redux slices
│       │   ├── store.ts # Store setup
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-template-mui/ # Material-UI component library (unbundled)
│   └── base/            # MUI components extracted from flowise-ui
│       ├── src/         # Source code
│       │   ├── components/ # Layout, dialogs, forms, cards, pagination
│       │   ├── themes/  # MUI theme configurations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (17MB CJS, 5.2MB ESM, 5KB types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-ui/          # Main UI application
│   ├── src/             # Source code
│   │   ├── ui-component/ # React components
│   │   ├── views/       # Page views
│   │   └── index.tsx    # Entry point
│   ├── public/          # Static files
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── metaverses-frt/      # Metaverse management frontend
│   └── base/            # Core metaverse UI functionality
│       ├── src/         # Source code
│       │   ├── components/ # Metaverse management UI
│       │   ├── i18n/    # Internationalization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metaverses-srv/      # Metaverse management backend
│   └── base/            # Core metaverse backend functionality
│       ├── src/         # Source code
│       │   ├── routes/  # Express routes for metaverse CRUD
│       │   ├── database/ # TypeORM entities and migrations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── multiplayer-colyseus-srv/ # Colyseus multiplayer server
│   ├── src/             # Source code
│   │   ├── rooms/       # Colyseus room implementations
│   │   ├── schemas/     # State schemas
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
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
│       │   ├── routes/  # Express routes for profile operations
│       │   ├── database/ # TypeORM entities and migrations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
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
├── space-builder-frt/   # Space Builder UI (prompt-to-flow)
│   └── base/            # Core Space Builder frontend functionality
│       ├── src/         # Source code
│       │   ├── components/ # Prompt dialog, FAB, model selector
│       │   ├── i18n/    # Internationalization
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── space-builder-srv/   # Space Builder API (prompt-to-flow)
│   └── base/            # Core Space Builder backend functionality
│       ├── src/         # Source code
│       │   ├── routes/  # Generate, health, config endpoints
│       │   ├── services/ # LLM integration and graph validation
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── spaces-frt/          # Spaces/Canvases frontend
│   └── base/            # Core spaces UI functionality
│       ├── src/         # Source code
│       │   ├── components/ # Canvas UI components
│       │   ├── i18n/    # Internationalization
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── spaces-srv/          # Spaces domain backend
│   └── base/            # Core spaces backend functionality
│       ├── src/         # Source code
│       │   ├── routes/  # Express routes for spaces CRUD
│       │   ├── database/ # TypeORM entities and migrations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── template-mmoomm/     # PlayCanvas MMOOMM template package
│   └── base/            # MMOOMM template functionality
│       ├── src/         # Source code
│       │   ├── playcanvas/ # PlayCanvas specific implementations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── template-quiz/       # AR.js Quiz template package
│   └── base/            # Quiz template functionality
│       ├── src/         # Source code
│       │   ├── arjs/    # AR.js specific implementations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── uniks-frt/           # Workspace management frontend
│   └── base/            # Core workspace functionality
│       ├── src/         # Source code
│       │   ├── i18n/    # Internationalization
│       │   ├── pages/   # Page components (UnikList, UnikDetail, UnikDialog)
│       │   ├── menu-items/ # Menu configurations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
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
├── universo-api-client/ # TypeScript API client
│   ├── src/             # Source code
│   │   ├── clients/     # API client implementations
│   │   ├── types/       # Request/response types
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output (CJS, ESM, types)
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-i18n/       # Centralized i18n instance
│   ├── src/             # Source code
│   │   ├── locales/     # Translation files
│   │   ├── i18n.ts      # i18next configuration
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-rest-docs/  # API documentation server
│   ├── src/             # Source code
│   │   ├── swagger/     # OpenAPI specifications
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-template-mui/ # Material-UI template implementation
│   └── base/            # Core MUI template functionality
│       ├── src/         # Source code
│       │   ├── layouts/ # Layout components
│       │   ├── themes/  # Theme configurations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-types/      # Shared TypeScript types and interfaces
│   └── base/            # Core type definitions
│       ├── src/         # Source code
│       │   ├── interfaces/ # UPDL and platform interfaces
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-utils/      # Shared utilities and processors
│   └── base/            # Core utility functions
│       ├── src/         # Source code
│       │   ├── updl/    # UPDL processing utilities (UPDLProcessor)
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── updl/                # UPDL node system for creating universal 3D/AR/VR spaces
│   └── base/            # Core UPDL functionality
│       ├── src/         # Source code
│       │   ├── assets/  # Static resources (icons, images)
│       │   ├── i18n/    # Internationalization
│       │   ├── interfaces/ # TypeScript types
│       │   ├── nodes/   # UPDL node definitions
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md            # This documentation
```

## Applications

### Core Platform Packages

#### Flowise Components (flowise-components)

Core Flowise node component implementations that power the visual programming interface.

**Key Features:**

-   Complete node library for Flowise workflows
-   Integration with LangChain and other AI tools
-   Custom UPDL node implementations
-   Dual build system (tsdown): CJS + ESM outputs

**Documentation:** See [packages/flowise-components/README.md](./flowise-components/README.md)

#### Flowise Server (flowise-server)

The main backend server for Universo Platformo, providing API endpoints, database management, and business logic.

**Key Features:**

-   Express-based REST API
-   TypeORM integration for PostgreSQL
-   Supabase authentication integration
-   Entity and migration registry system
-   Asynchronous route initialization

**Documentation:** See [packages/flowise-server/README.md](./flowise-server/README.md)

#### Flowise UI (flowise-ui)

The main React frontend application providing the visual programming interface.

**Key Features:**

-   React Flow-based canvas editor
-   Material-UI component library
-   Real-time flow execution
-   Credential and configuration management
-   Multi-workspace support

**Documentation:** See [packages/flowise-ui/README.md](./flowise-ui/README.md)

### Shared UI Components

#### Flowise Template MUI (@flowise/template-mui)

Material-UI component library extracted from flowise-ui monolith using the unbundled source pattern.

**Key Features:**

-   Extracted MUI components (Layout, Dialogs, Forms, Cards, Pagination)
-   Unbundled source pattern: distributes raw `.tsx` files
-   Large build output: 17MB CJS, 5.2MB ESM, 5KB types
-   Eliminates duplication across frontend packages
-   Theme configurations and customizations

**Documentation:** See [packages/flowise-template-mui/base/README.md](./flowise-template-mui/base/README.md)

#### Flowise Chat Message (@flowise/chatmessage)

Reusable chat interface components with streaming, audio recording, and file upload support.

**Key Features:**

-   7 chat components: ChatPopUp, ChatMessage, ChatExpandDialog, etc.
-   Eliminated ~7692 lines of duplication (3 copies → 1 package)
-   Streaming message support
-   Audio recording functionality
-   File upload integration
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/flowise-chatmessage/base/README.md](./flowise-chatmessage/base/README.md)

#### Flowise Store (@flowise/store)

Shared Redux store configuration for Flowise applications.

**Key Features:**

-   Centralized state management
-   Redux Toolkit integration
-   Reusable slices across frontend packages
-   TypeScript support
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/flowise-store/base/README.md](./flowise-store/base/README.md)

### Shared Infrastructure Packages

#### Universo Platformo Types (@universo/types)

A shared package containing all TypeScript type definitions and interfaces used across the platform.

**Key Features:**

-   **UPDL Interfaces**: Complete type definitions for UPDL nodes, spaces, and flow data
-   **Platform Types**: Shared types for publication, authentication, and API communication
-   **Dual Build System**: Compiled to both CommonJS and ES Modules for maximum compatibility
-   **Type-Only Package**: Pure TypeScript definitions without runtime dependencies

**Documentation:** See [packages/universo-types/base/README.md](./universo-types/base/README.md)

#### Universo Platformo Utils (@universo/utils)

A shared package containing utility functions and processors used across multiple applications.

**Key Features:**

-   **UPDLProcessor**: Core processor for converting flow data to UPDL structures
-   **Multi-Scene Support**: Handles both single space and multi-scene UPDL flows
-   **Template Agnostic**: Provides foundation for all template builders
-   **Dual Build System**: Compiled to both CommonJS and ES Modules (tsdown)

**Documentation:** See [packages/universo-utils/base/README.md](./universo-utils/base/README.md)

#### Universo API Client (@universo/api-client)

TypeScript API client for Universo Platformo backend services.

**Key Features:**

-   Type-safe API clients for all backend services
-   Axios-based HTTP communication
-   Request/response type definitions
-   Error handling and retry logic
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/universo-api-client/README.md](./universo-api-client/README.md)

#### Universo i18n (@universo/i18n)

Centralized i18next instance for internationalization across all Universo Platformo packages.

**Key Features:**

-   Shared i18next configuration
-   Translation file management
-   Language detection and switching
-   Namespace support for modular translations

**Documentation:** See [packages/universo-i18n/README.md](./universo-i18n/README.md)

#### Universo Template MUI (@universo/template-mui)

Material-UI template implementation for Universo Platformo React applications.

**Key Features:**

-   Reusable layout components
-   Consistent theme configurations
-   Responsive design patterns
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/universo-template-mui/base/README.md](./universo-template-mui/base/README.md)

#### Universo REST Docs (universo-rest-docs)

API documentation server using OpenAPI/Swagger specifications.

**Key Features:**

-   Interactive API documentation
-   OpenAPI 3.0 specifications
-   Swagger UI integration
-   Auto-generated from TypeScript types

**Documentation:** See [packages/universo-rest-docs/README.md](./universo-rest-docs/README.md)

### Authentication System

#### Auth Frontend (@universo/auth-frt)

Shared authentication UI primitives for Universo Platformo.

**Key Features:**

-   LoginForm, SessionGuard, and other auth components
-   React hooks for authentication state
-   Session-based authentication UI
-   Integration with Supabase auth
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/auth-frt/base/README.md](./auth-frt/base/README.md)

#### Auth Server (@universo/auth-srv)

Passport.js + Supabase session toolkit for backend authentication.

**Key Features:**

-   Passport.js strategies (local, JWT)
-   Supabase session management
-   Session middleware for Express
-   Login, logout, and session validation routes
-   Dual build system (tsdown): CJS + ESM

**Documentation:** See [packages/auth-srv/base/README.md](./auth-srv/base/README.md)

### Template Packages

#### Quiz Template (@universo/template-quiz)

A specialized template package for creating AR.js educational quizzes with lead collection.

**Key Features:**

-   **AR.js Integration**: Complete AR.js quiz implementation with marker tracking
-   **Multi-Scene Quizzes**: Support for sequential question flows
-   **Lead Collection**: Built-in forms for collecting user information
-   **Points System**: Automatic scoring and results display
-   **Modular Architecture**: Separate handlers for different UPDL node types
-   **Dual Build System**: tsdown (CJS + ESM + Types)

**Documentation:** See [packages/template-quiz/base/README.md](./template-quiz/base/README.md)

#### MMOOMM Template (@universo/template-mmoomm)

A specialized template package for creating PlayCanvas space MMO experiences.

**Key Features:**

-   **Space MMO Environment**: Complete 3D space simulation with physics
-   **Industrial Mining**: Laser mining system with auto-targeting
-   **Entity System**: Ships, asteroids, stations, and gates
-   **Multiplayer Support**: Real-time networking with Colyseus
-   **Advanced Controls**: WASD+QZ movement with quaternion rotation
-   **Dual Build System**: tsdown (CJS + ESM + Types)

**Documentation:** See [packages/template-mmoomm/base/README.md](./template-mmoomm/base/README.md)

### Multiplayer Infrastructure

#### Multiplayer Colyseus Server (@universo/multiplayer-colyseus-srv)

Colyseus multiplayer server for real-time networking in MMOOMM experiences.

**Key Features:**

-   Colyseus room implementations
-   State synchronization
-   Player connection management
-   Entity replication for ships, asteroids, and projectiles
-   Integration with template-mmoomm

**Documentation:** See [packages/multiplayer-colyseus-srv/README.md](./multiplayer-colyseus-srv/README.md)

### Domain Modules

#### Uniks (Workspace Management)

The Uniks application provides workspace management functionality, allowing users to create, manage, and organize their workspaces. It consists of a frontend application and a backend workspace package.

##### Uniks Frontend (@universo/uniks-frt)

**Key Features:**

-   Workspace creation and management interface
-   User-friendly workspace listing and navigation
-   Workspace member management
-   Responsive design with Material-UI components
-   Internationalization support (English and Russian)
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/uniks-frt/base/README.md](./uniks-frt/base/README.md)

##### Uniks Server (@universo/uniks-srv)

This is a backend service, structured as a workspace package (`@universo/uniks-srv`), responsible for handling workspace data and operations.

**Key Features:**

-   Express routes for Uniks CRUD operations
-   TypeORM entities (`Unik`, `UserUnik`) for database management
-   PostgreSQL database migrations
-   Supabase integration for authentication
-   Nested route mounting for Flowise routes under `/:unikId` prefix

**Documentation:** See [packages/uniks-srv/base/README.md](./uniks-srv/base/README.md)

#### Profile

The Profile application provides user profile management functionality. It consists of a frontend application and a backend workspace package.

##### Profile Frontend (@universo/profile-frt)

**Key Features:**

-   JWT token-based authentication with Supabase
-   Email and password update functionality
-   Mobile-friendly responsive design
-   Internationalization support (English and Russian)

**Documentation:** See [packages/profile-frt/base/README.md](./profile-frt/base/README.md)

##### Profile Server (@universo/profile-srv)

This is a backend service, structured as a workspace package (`@universo/profile-srv`), responsible for handling user profile data securely.

**Key Features:**

-   Secure endpoints for user data management
-   Uses custom SQL functions with `SECURITY DEFINER` for safe data updates
-   Asynchronous route initialization to prevent race conditions with the database connection

**Documentation:** See [packages/profile-srv/base/README.md](./profile-srv/base/README.md)

#### Spaces (Canvas Management)

The Spaces application provides canvas and flow management functionality. It consists of a frontend application and a backend workspace package.

##### Spaces Frontend (@universo/spaces-frt)

**Key Features:**

-   Canvas UI components extracted from flowise-ui
-   Flow/space management interface
-   Integration with React Flow
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/spaces-frt/base/README.md](./spaces-frt/base/README.md)

##### Spaces Server (@universo/spaces-srv)

This is a backend service for managing spaces and canvases.

**Key Features:**

-   Express routes for spaces CRUD operations
-   TypeORM entities for space management
-   PostgreSQL database migrations
-   Integration with flowise-server

**Documentation:** See [packages/spaces-srv/base/README.md](./spaces-srv/base/README.md)

#### Metaverses

The Metaverses application provides metaverse management functionality. It consists of a frontend application and a backend workspace package.

##### Metaverses Frontend (@universo/metaverses-frt)

**Key Features:**

-   Metaverse creation and management UI
-   Metaverse listing and navigation
-   Responsive design with Material-UI
-   Internationalization support
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/metaverses-frt/base/README.md](./metaverses-frt/base/README.md)

##### Metaverses Server (@universo/metaverses-srv)

This is a backend service for metaverse management.

**Key Features:**

-   Express routes for metaverse CRUD operations
-   TypeORM entities for metaverse data
-   PostgreSQL database migrations
-   Integration with flowise-server

**Documentation:** See [packages/metaverses-srv/base/README.md](./metaverses-srv/base/README.md)

#### Analytics

The Analytics application provides quiz analytics functionality.

##### Analytics Frontend (@universo/analytics-frt)

**Key Features:**

-   Quiz analytics dashboard
-   Data visualization components
-   Internationalization support
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/analytics-frt/base/README.md](./analytics-frt/base/README.md)

### Space Builder (Prompt-to-Flow)

The Space Builder application turns natural-language prompts into Flow graphs composed of UPDL nodes. It consists of a frontend application and a backend workspace package.

#### Space Builder Frontend (@universo/space-builder-frt)

**Key Features:**

-   Prompt-to-flow generation (MUI dialog + FAB)
-   Model selection from Credentials; optional Test mode (via server env)
-   Append/Replace modes on the canvas
-   I18n integration
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/space-builder-frt/base/README.md](./space-builder-frt/base/README.md)

#### Space Builder Server (@universo/space-builder-srv)

This is a backend service, structured as a workspace package (`@universo/space-builder-srv`), responsible for LLM call and safe JSON graph return.

**Key Features:**

-   Endpoints: `/api/v1/space-builder/health`, `/config`, `/generate`
-   Meta-prompt → provider call → RAW JSON extraction
-   Credential resolution integrated with platform services
-   Zod-based validation and server-side normalization

**Documentation:** See [packages/space-builder-srv/base/README.md](./space-builder-srv/base/README.md)

### UPDL (Universal Platform Definition Language)

The UPDL application provides a unified node system for describing 3D/AR/VR spaces that can be exported to multiple target platforms. It defines a standardized intermediate representation layer that abstracts away the specifics of different rendering engines.

#### UPDL (@universo/updl)

**Key Features:**

-   7 core high-level nodes for universal 3D/AR/VR scene description
-   Legacy nodes (Object, Camera, Light) for backward compatibility
-   Node definitions and icons
-   Pure Flowise integration
-   TypeScript interfaces
-   Dual build system (tsdown): CJS + ESM + Types

**Interface Architecture:**

-   **Core UPDL Interfaces** (`UPDLInterfaces.ts`): Complete ecosystem definitions for flows, graphs, and detailed node properties
-   **Integration Interfaces** (`Interface.UPDL.ts`): Simplified interfaces for backend/frontend integration via `@server/interface` alias

**Documentation:** See [packages/updl/base/README.md](./updl/base/README.md)

### Publish

The Publish application provides mechanisms for exporting UPDL spaces to AR.js and publishing them with shareable URLs.

#### Publish Frontend (@universo/publish-frt)

The frontend application is responsible for the entire user-facing publication workflow, including the final conversion of data to viewable AR.js and PlayCanvas formats.

**Key Features:**

-   **Client-Side UPDL Processing**: Uses the shared `UPDLProcessor` from `@universo/utils` to convert raw `flowData` from the backend into valid AR.js and PlayCanvas experiences
-   **Template Registry System**: Modular template system that dynamically loads specialized template packages (`@universo/template-quiz`, `@universo/template-mmoomm`)
-   **Shared Type System**: Uses `@universo/types` for consistent type definitions across all templates and builders
-   **Template Packages**: Delegates specific functionality to specialized template packages for maintainability and modularity
-   **Supabase Integration**: Persists publication configurations
-   **Multi-Technology Support**: Supports AR.js quizzes and PlayCanvas MMO experiences through dedicated template packages

**Documentation:** See [packages/publish-frt/base/README.md](./publish-frt/base/README.md)

#### Publish Backend (@universo/publish-srv)

This is a backend service, refactored into a workspace package (`@universo/publish-srv`), with a single responsibility: serving data to the frontend.

**Key Features:**

-   **Workspace Package**: Provides shared types and services as `@universo/publish-srv`
-   **Raw Data Provider**: Serves raw `flowData` from the database, delegating all UPDL processing to the frontend
-   **Source of Truth for Types**: Exports all shared UPDL and publication-related TypeScript types
-   **Asynchronous Route Initialization**: Prevents race conditions by initializing routes only after a database connection is established

**Documentation:** See [packages/publish-srv/base/README.md](./publish-srv/base/README.md)

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

## Build System Evolution

### tsdown Migration

Many packages have migrated from the legacy tsc+gulp build system to **tsdown** for faster and more efficient builds:

**Migrated packages (tsdown):**

-   `@universo/analytics-frt`
-   `@universo/auth-frt`
-   `@universo/auth-srv`
-   `@flowise/chatmessage`
-   `@flowise/store`
-   `@universo/metaverses-frt`
-   `@universo/spaces-frt`
-   `@universo/space-builder-frt`
-   `@universo/template-mmoomm`
-   `@universo/template-quiz`
-   `@universo/template-mui`
-   `@universo/types`
-   `@universo/uniks-frt`
-   `@universo/updl`
-   `@universo/utils`
-   `@universo/api-client`
-   `flowise-components`

**Legacy packages (tsc+gulp):**

-   `@universo/profile-frt` (has gulpfile.ts)
-   `@universo/publish-frt` (has gulpfile.ts)

**tsdown benefits:**

-   Dual build output: CommonJS + ES Modules + TypeScript declarations
-   Faster build times
-   Automatic asset handling
-   Simplified configuration

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

## Technology Requirements

**Core Platform:**
- **Node.js**: >=18.15.0 <19.0.0 || ^20 (LTS versions required for production)
- **PNPM**: >=9 (package manager for monorepo)
- **Flowise AI**: 2.2.8 (base visual programming platform)

**Build Tools:**
- **TypeScript**: Strict mode enabled across all packages
- **tsdown**: v0.15.7 (Rolldown + Oxc based bundler for custom packages)
- **Turborepo**: Efficient monorepo build orchestration

**Frontend:**
- **React**: Core UI library (version managed by Flowise)
- **Material-UI (MUI)**: v6 with ColorScheme API for dark mode support
- **React Flow**: Node-based visual editor infrastructure

**Backend:**
- **Express**: Node.js web framework
- **TypeORM**: 0.3.20+ for database access (PostgreSQL only)
- **Supabase**: Authentication and database backend

**Development:**
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **i18next**: Internationalization (EN/RU support)

## Development Guidelines

1. **Modularity:** Keep each application self-contained with clear interfaces
2. **Minimal Core Changes:** Avoid modifying the main Flowise codebase
3. **Documentation:** Maintain README files in each application directory
4. **Shared Types:** Use common type definitions for inter-application communication
5. **Build System:** Prefer tsdown for new packages; migrate legacy packages gradually
6. **i18n:** Use `@universo/i18n` for centralized internationalization

## Building

From the project root:

```bash
# Install all dependencies for workspace
pnpm install

# Build all applications (and other packages in workspace)
pnpm build

# Build shared infrastructure packages
pnpm build --filter @universo/types
pnpm build --filter @universo/utils
pnpm build --filter @universo/api-client
pnpm build --filter @universo/i18n

# Build shared UI components
pnpm build --filter @flowise/template-mui
pnpm build --filter @flowise/chatmessage
pnpm build --filter @flowise/store
pnpm build --filter @universo/template-mui

# Build template packages
pnpm build --filter @universo/template-quiz
pnpm build --filter @universo/template-mmoomm

# Build authentication packages
pnpm build --filter @universo/auth-frt
pnpm build --filter @universo/auth-srv

# Build domain frontend applications
pnpm build --filter @universo/analytics-frt
pnpm build --filter @universo/metaverses-frt
pnpm build --filter @universo/profile-frt
pnpm build --filter @universo/publish-frt
pnpm build --filter @universo/space-builder-frt
pnpm build --filter @universo/spaces-frt
pnpm build --filter @universo/uniks-frt
pnpm build --filter @universo/updl

# Build domain backend applications
pnpm build --filter @universo/metaverses-srv
pnpm build --filter @universo/profile-srv
pnpm build --filter @universo/publish-srv
pnpm build --filter @universo/space-builder-srv
pnpm build --filter @universo/spaces-srv
pnpm build --filter @universo/uniks-srv
pnpm build --filter @universo/multiplayer-colyseus-srv

# Build core platform
pnpm build --filter flowise-components
pnpm build --filter flowise-server
pnpm build --filter flowise-ui
pnpm build --filter universo-rest-docs
```

## Development

To run a specific application in development mode (watches for changes and rebuilds):

```bash
# Frontend packages (tsdown watch mode)
pnpm --filter @universo/analytics-frt dev
pnpm --filter @universo/auth-frt dev
pnpm --filter @flowise/chatmessage dev
pnpm --filter @universo/metaverses-frt dev
pnpm --filter @universo/profile-frt dev
pnpm --filter @universo/publish-frt dev
pnpm --filter @universo/space-builder-frt dev
pnpm --filter @universo/spaces-frt dev
pnpm --filter @universo/uniks-frt dev
pnpm --filter @universo/updl dev

# Backend packages
pnpm --filter @universo/auth-srv dev
pnpm --filter @universo/metaverses-srv dev
pnpm --filter @universo/profile-srv dev
pnpm --filter @universo/publish-srv dev
pnpm --filter @universo/space-builder-srv dev
pnpm --filter @universo/spaces-srv dev
pnpm --filter @universo/uniks-srv dev
pnpm --filter @universo/multiplayer-colyseus-srv dev
```

**Note about resources:** For packages still using gulp (legacy build), watch scripts don't automatically copy SVG icons. If you add or modify SVG resources during development, run `pnpm build --filter <app>` to ensure they are properly copied to the dist directory. Packages using tsdown handle assets automatically.

---

_Universo Platformo | Apps Documentation_
