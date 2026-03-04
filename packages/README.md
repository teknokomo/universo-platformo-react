# Universo Platformo Apps Directory

This directory contains modular applications and shared libraries of the Universo Platformo, providing additional functionality in a modular architecture.

## Current Structure

```
packages/
├── admin-backend/            # Admin panel backend
│   └── base/            # Core admin backend functionality
│       ├── src/         # Source code
│       │   ├── database/ # TypeORM entities and migrations
│       │   ├── guards/  # Authorization guards
│       │   ├── routes/  # Express routes for admin operations
│       │   ├── schemas/ # Validation schemas
│       │   ├── services/ # Business logic
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── admin-frontend/           # Admin panel frontend
│   └── base/            # Core admin frontend functionality
│       ├── src/         # Source code
│       │   ├── api/     # API clients
│       │   ├── components/ # Admin UI components
│       │   ├── hooks/   # React hooks
│       │   ├── i18n/    # Internationalization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── applications-backend/     # Applications management backend
│   └── base/            # Core applications backend functionality
│       ├── src/         # Source code
│       │   ├── database/ # TypeORM entities and migrations
│       │   ├── routes/  # Express routes
│       │   ├── schemas/ # Validation schemas
│       │   ├── services/ # Business logic
│       │   ├── tests/   # Test files
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── applications-frontend/    # Applications management frontend
│   └── base/            # Core applications frontend functionality
│       ├── src/         # Source code
│       │   ├── api/     # API clients
│       │   ├── components/ # Applications UI components
│       │   ├── hooks/   # React hooks
│       │   ├── i18n/    # Internationalization
│       │   ├── pages/   # Page components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── apps-template-mui/        # Apps MUI template with shared layouts and themes
│       ├── src/         # Source code
│       │   ├── components/ # Shared MUI components
│       │   ├── layouts/ # Layout components
│       │   ├── shared-theme/ # Theme configurations
│       │   └── index.ts # Entry point
│       ├── package.json
│       └── README.md
├── auth-backend/             # Passport.js + Supabase session backend
│   └── base/            # Core auth backend functionality
│       ├── src/         # Source code
│       │   ├── middleware/ # Passport strategies and session handlers
│       │   ├── routes/  # Auth routes (login, logout, session)
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-frontend/            # Authentication UI primitives
│   └── base/            # Core auth UI functionality
│       ├── src/         # Source code
│       │   ├── components/ # Auth components (LoginForm, SessionGuard)
│       │   ├── hooks/   # React hooks for auth
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metahubs-backend/         # MetaHubs management backend
│   └── base/            # Core MetaHubs backend functionality
│       ├── src/         # Source code
│       │   ├── database/ # TypeORM entities and migrations
│       │   ├── domains/ # Domain logic modules
│       │   ├── services/ # Business logic
│       │   ├── tests/   # Test files
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metahubs-frontend/        # MetaHubs management frontend
│   └── base/            # Core MetaHubs frontend functionality
│       ├── src/         # Source code
│       │   ├── components/ # MetaHubs UI components
│       │   ├── domains/ # Domain-specific feature modules
│       │   ├── hooks/   # React hooks
│       │   ├── i18n/    # Internationalization
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── migration-guard-shared/   # Shared migration guard utilities
│   └── base/            # Core migration guard functionality
│       ├── src/         # Source code
│       │   ├── MigrationGuardShell.tsx # Guard shell component
│       │   ├── utils.ts # Utility functions
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── profile-backend/          # User profile management backend
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
├── profile-frontend/         # User profile management frontend
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
├── schema-ddl/               # Schema DDL utilities
│   └── base/            # Core schema DDL functionality
│       ├── src/         # Source code
│       │   ├── SchemaGenerator.ts # Runtime schema generation
│       │   ├── SchemaMigrator.ts  # Schema migration logic
│       │   ├── diff.ts  # Schema diff calculation
│       │   ├── __tests__/ # Test files
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── start-backend/            # Onboarding/start page backend
│   └── base/            # Core start backend functionality
│       ├── src/         # Source code
│       │   ├── routes/  # Express routes
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── start-frontend/           # Onboarding/start page frontend
│   └── base/            # Core start frontend functionality
│       ├── src/         # Source code
│       │   ├── api/     # API clients
│       │   ├── components/ # Start page UI components
│       │   ├── hooks/   # React hooks
│       │   ├── i18n/    # Internationalization
│       │   ├── views/   # View components
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-api-client/      # TypeScript API client
│   └── base/            # Core API client functionality
│       ├── src/         # Source code
│       │   ├── clients/ # API client implementations
│       │   ├── types/   # Request/response types
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-core-backend/    # Core backend server (formerly flowise-server)
│   └── base/            # Core backend functionality
│       ├── src/         # Source code
│       │   ├── database/ # TypeORM entities and migrations
│       │   ├── routes/  # API routes
│       │   ├── middlewares/ # Express middlewares
│       │   ├── utils/   # Utility functions
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-core-frontend/   # Core frontend UI (formerly flowise-ui)
│   └── base/            # Core frontend functionality
│       ├── src/         # Source code
│       │   ├── components/ # React components
│       │   ├── api/     # API clients
│       │   └── index.jsx # Entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-i18n/            # Centralized i18n instance
│   └── base/            # Core i18n functionality
│       ├── src/         # Source code
│       │   ├── locales/ # Translation files
│       │   ├── i18n.ts  # i18next configuration
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-rest-docs/       # API documentation server
│       ├── src/         # Source code
│       │   ├── swagger/ # OpenAPI specifications
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-store/           # Shared Redux store (formerly flowise-store)
│   └── base/            # Redux store configuration
│       ├── src/         # Source code
│       │   ├── reducers/ # Redux reducers
│       │   ├── context/ # React context
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-template-mui/    # Material-UI template implementation
│   └── base/            # Core MUI template functionality
│       ├── src/         # Source code
│       │   ├── layouts/ # Layout components
│       │   ├── themes/  # Theme configurations
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-types/           # Shared TypeScript types and interfaces
│   └── base/            # Core type definitions
│       ├── src/         # Source code
│       │   ├── interfaces/ # Platform interfaces
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-utils/           # Shared utilities and processors
│   └── base/            # Core utility functions
│       ├── src/         # Source code
│       │   └── index.ts # Entry point
│       ├── dist/        # Compiled output (CJS, ESM, types)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md                 # This documentation
```

## Applications

### Core Platform Packages

#### Universo Core Backend (@universo/core-backend)

The main backend server for Universo Platformo, providing API endpoints, database management, and business logic.

**Key Features:**

-   Express-based REST API
-   TypeORM integration for PostgreSQL
-   Supabase authentication integration
-   Entity and migration registry system
-   Asynchronous route initialization

**Documentation:** See [packages/universo-core-backend/base/README.md](./universo-core-backend/base/README.md)

#### Universo Core Frontend (@universo/core-frontend)

The main React frontend application providing the visual programming interface.

**Key Features:**

-   Material-UI component library
-   Real-time flow execution
-   Credential and configuration management
-   Multi-workspace support

**Documentation:** See [packages/universo-core-frontend/base/README.md](./universo-core-frontend/base/README.md)

### Shared Infrastructure Packages

#### Universo Store (@universo/store)

Shared Redux store configuration for Universo Platformo applications.

**Key Features:**

-   Centralized state management
-   Redux reducers and context
-   Reusable state logic across frontend packages
-   TypeScript support

**Documentation:** See [packages/universo-store/base/README.md](./universo-store/base/README.md)

#### Universo Platformo Types (@universo/types)

A shared package containing all TypeScript type definitions and interfaces used across the platform.

**Key Features:**

-   **Platform Interfaces**: Shared types for all platform operations
-   **Dual Build System**: Compiled to both CommonJS and ES Modules for maximum compatibility
-   **Type-Only Package**: Pure TypeScript definitions without runtime dependencies

**Documentation:** See [packages/universo-types/base/README.md](./universo-types/base/README.md)

#### Universo Platformo Utils (@universo/utils)

A shared package containing utility functions and processors used across multiple applications.

**Key Features:**

-   Shared utility functions for platform operations
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

**Documentation:** See [packages/universo-api-client/base/README.md](./universo-api-client/base/README.md)

#### Universo i18n (@universo/i18n)

Centralized i18next instance for internationalization across all Universo Platformo packages.

**Key Features:**

-   Shared i18next configuration
-   Translation file management
-   Language detection and switching
-   Namespace support for modular translations

**Documentation:** See [packages/universo-i18n/base/README.md](./universo-i18n/base/README.md)

#### Universo Template MUI (@universo/template-mui)

Material-UI template implementation for Universo Platformo React applications.

**Key Features:**

-   Reusable layout components
-   Consistent theme configurations
-   Responsive design patterns
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/universo-template-mui/base/README.md](./universo-template-mui/base/README.md)

#### Apps Template MUI (@universo/apps-template-mui)

MUI-based application template providing shared layouts, themes, and dashboard components.

**Key Features:**

-   Dashboard and CRUD layouts
-   Shared MUI theme configurations
-   Routing infrastructure
-   Blog and marketing page templates

**Documentation:** See [packages/apps-template-mui/README.md](./apps-template-mui/README.md)

#### Universo REST Docs (@universo/rest-docs)

API documentation server using OpenAPI/Swagger specifications.

**Key Features:**

-   Interactive API documentation
-   OpenAPI 3.0 specifications
-   Swagger UI integration
-   Auto-generated from TypeScript types

**Documentation:** See [packages/universo-rest-docs/README.md](./universo-rest-docs/README.md)

#### Schema DDL (@universo/schema-ddl)

Schema DDL utilities for runtime schema generation, migration, and diff calculation.

**Key Features:**

-   Runtime schema generation (SchemaGenerator)
-   Schema migration logic (SchemaMigrator)
-   Schema diff calculation
-   Database locking and snapshotting utilities

**Documentation:** See [packages/schema-ddl/base/README.md](./schema-ddl/base/README.md)

#### Migration Guard Shared (@universo/migration-guard-shared)

Shared utilities and components for migration guard functionality across MetaHubs and Applications.

**Key Features:**

-   MigrationGuardShell React component
-   Migration status query utilities
-   Severity determination logic
-   Shared across metahubs and applications modules

**Documentation:** See [packages/migration-guard-shared/base/README.md](./migration-guard-shared/base/README.md)

### Authentication System

#### Auth Frontend (@universo/auth-frontend)

Shared authentication UI primitives for Universo Platformo.

**Key Features:**

-   LoginForm, SessionGuard, and other auth components
-   React hooks for authentication state
-   Session-based authentication UI
-   Integration with Supabase auth
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/auth-frontend/base/README.md](./auth-frontend/base/README.md)

#### Auth Server (@universo/auth-backend)

Passport.js + Supabase session toolkit for backend authentication.

**Key Features:**

-   Passport.js strategies (local, JWT)
-   Supabase session management
-   Session middleware for Express
-   Login, logout, and session validation routes
-   Dual build system (tsdown): CJS + ESM

**Documentation:** See [packages/auth-backend/base/README.md](./auth-backend/base/README.md)

### Domain Modules

#### Admin (Global User Management)

The Admin application provides global user management functionality for platform administrators. It consists of a frontend application and a backend workspace package.

##### Admin Frontend (@universo/admin-frontend)

**Key Features:**

-   Global user management interface
-   Admin panel UI with Material-UI components
-   Internationalization support
-   API-driven admin operations

**Documentation:** See [packages/admin-frontend/base/README.md](./admin-frontend/base/README.md)

##### Admin Server (@universo/admin-backend)

This is a backend service, structured as a workspace package (`@universo/admin-backend`), responsible for global user management operations.

**Key Features:**

-   Express routes for admin CRUD operations
-   TypeORM entities for admin data management
-   Authorization guards for admin access control
-   Validation schemas for input data

**Documentation:** See [packages/admin-backend/base/README.md](./admin-backend/base/README.md)

#### Applications

The Applications module provides application lifecycle management functionality. It consists of a frontend application and a backend workspace package.

##### Applications Frontend (@universo/applications-frontend)

**Key Features:**

-   Application creation and management interface
-   Application listing with menu integration
-   Responsive design with Material-UI components
-   Internationalization support (English and Russian)
-   Comprehensive test coverage

**Documentation:** See [packages/applications-frontend/base/README.md](./applications-frontend/base/README.md)

##### Applications Server (@universo/applications-backend)

This is a backend service, structured as a workspace package (`@universo/applications-backend`), responsible for handling application data and operations.

**Key Features:**

-   Express routes for application CRUD operations
-   TypeORM entities for database management
-   Validation schemas
-   Test coverage with Jest

**Documentation:** See [packages/applications-backend/base/README.md](./applications-backend/base/README.md)

#### MetaHubs

The MetaHubs application provides metahub management functionality including schema management, settings, and enumerations. It consists of a frontend application and a backend workspace package.

##### MetaHubs Frontend (@universo/metahubs-frontend)

**Key Features:**

-   MetaHub management UI with domain-driven architecture
-   Schema, settings, and enumeration management
-   Responsive design with Material-UI
-   Internationalization support
-   Dual build system (tsdown): CJS + ESM + Types

**Documentation:** See [packages/metahubs-frontend/base/README.md](./metahubs-frontend/base/README.md)

##### MetaHubs Server (@universo/metahubs-backend)

This is a backend service for MetaHub management.

**Key Features:**

-   Domain-driven service architecture
-   TypeORM entities for MetaHub data
-   PostgreSQL database migrations
-   Test coverage with Jest

**Documentation:** See [packages/metahubs-backend/base/README.md](./metahubs-backend/base/README.md)

#### Profile

The Profile application provides user profile management functionality. It consists of a frontend application and a backend workspace package.

##### Profile Frontend (@universo/profile-frontend)

**Key Features:**

-   JWT token-based authentication with Supabase
-   Email and password update functionality
-   Mobile-friendly responsive design
-   Internationalization support (English and Russian)

**Documentation:** See [packages/profile-frontend/base/README.md](./profile-frontend/base/README.md)

##### Profile Server (@universo/profile-backend)

This is a backend service, structured as a workspace package (`@universo/profile-backend`), responsible for handling user profile data securely.

**Key Features:**

-   Secure endpoints for user data management
-   Uses custom SQL functions with `SECURITY DEFINER` for safe data updates
-   Asynchronous route initialization to prevent race conditions with the database connection

**Documentation:** See [packages/profile-backend/base/README.md](./profile-backend/base/README.md)

#### Start (Onboarding)

The Start application provides onboarding and start page functionality. It consists of a frontend application and a backend workspace package.

##### Start Frontend (@universo/start-frontend)

**Key Features:**

-   Onboarding wizard and start page UI
-   View components for initial setup
-   API-driven content loading
-   Internationalization support

**Documentation:** See [packages/start-frontend/base/README.md](./start-frontend/base/README.md)

##### Start Server (@universo/start-backend)

This is a backend service, structured as a workspace package (`@universo/start-backend`), responsible for onboarding and start page data.

**Key Features:**

-   Express routes for start page operations
-   Integration with platform services

**Documentation:** See [packages/start-backend/base/README.md](./start-backend/base/README.md)

## Architecture for Future Expansion

When expanding application functionality, you can create additional directories following this structure:

```
app-name/
├── base/                # Core functionality
│   ├── src/             # Source code
│   │   ├── api/         # API clients (for frontend)
│   │   ├── assets/      # Static resources (icons, images)
│   │   ├── components/  # React components (for frontend)
│   │   ├── configs/     # Configuration constants
│   │   ├── controllers/ # Express controllers (for backend)
│   │   ├── database/    # TypeORM entities and migrations (for backend)
│   │   ├── domains/     # Domain logic modules
│   │   ├── features/    # Feature modules
│   │   ├── hooks/       # React hooks (for frontend)
│   │   ├── i18n/        # Internationalization resources
│   │   ├── interfaces/  # TypeScript interfaces and types
│   │   ├── middlewares/ # Middleware handlers (for backend)
│   │   ├── models/      # Data models (for backend)
│   │   ├── routes/      # REST API routes (for backend)
│   │   ├── services/    # Business logic (for backend)
│   │   ├── store/       # State management (for frontend)
│   │   ├── utils/       # Utilities
│   │   ├── validators/  # Input validation (for backend)
│   │   └── index.ts     # Entry point
│   ├── dist/            # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
```

**Note:** Not all directories are required for every application. Create only the directories that are needed for your specific functionality:

-   **Frontend applications** typically need: `api/`, `assets/`, `components/`, `hooks/`, `i18n/`, `pages/`, `utils/`
-   **Backend applications** typically need: `database/`, `routes/`, `services/`, `utils/`

## Build System Evolution

### tsdown Migration

Many packages have migrated from the legacy tsc+gulp build system to **tsdown** for faster and more efficient builds:

**Migrated packages (tsdown):**

-   `@universo/auth-frontend`
-   `@universo/auth-backend`
-   `@universo/store`
-   `@universo/metahubs-frontend`
-   `@universo/template-mui`
-   `@universo/types`
-   `@universo/utils`
-   `@universo/api-client`
-   `@universo/i18n`
-   `@universo/migration-guard-shared`

**Legacy packages (tsc or tsc+gulp):**

-   `@universo/profile-frontend` (has gulpfile.ts)

**tsdown benefits:**

-   Dual build output: CommonJS + ES Modules + TypeScript declarations
-   Faster build times
-   Automatic asset handling
-   Simplified configuration

## Interactions

The applications in this directory are designed to work together in a modular architecture:

```
┌─────────────────────────────────────────────────────┐
│                    Core Platform                     │
│  ┌─────────────────┐    ┌──────────────────────┐    │
│  │ Core Backend     │◄──►│ Core Frontend        │    │
│  │ (@universo/      │    │ (@universo/          │    │
│  │  core-backend)   │    │  core-frontend)      │    │
│  └────────┬─────────┘    └──────────┬───────────┘   │
└───────────┼──────────────────────────┼───────────────┘
            │                          │
            ▼                          ▼
┌───────────────────────┐  ┌──────────────────────────┐
│   Backend Modules     │  │   Frontend Modules       │
│ ┌───────────────────┐ │  │ ┌──────────────────────┐ │
│ │ admin-backend     │ │  │ │ admin-frontend       │ │
│ │ applications-bknd │ │  │ │ applications-frt     │ │
│ │ metahubs-backend  │ │  │ │ metahubs-frontend    │ │
│ │ profile-backend   │ │  │ │ profile-frontend     │ │
│ │ start-backend     │ │  │ │ start-frontend       │ │
│ └───────────────────┘ │  │ └──────────────────────┘ │
└───────────────────────┘  └──────────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Shared Infrastructure                   │
│  @universo/types  @universo/utils  @universo/i18n   │
│  @universo/store  @universo/template-mui            │
│  @universo/api-client  @universo/schema-ddl         │
└─────────────────────────────────────────────────────┘
```

## Technology Requirements

**Core Platform:**
- **Node.js**: >=18.15.0 <19.0.0 || ^20 (LTS versions required for production)
- **PNPM**: >=9 (package manager for monorepo)

**Build Tools:**
- **TypeScript**: Strict mode enabled across all packages
- **tsdown**: v0.15.7 (Rolldown + Oxc based bundler for custom packages)
- **Turborepo**: Efficient monorepo build orchestration

**Frontend:**
- **React**: Core UI library
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
2. **Minimal Core Changes:** Avoid modifying the core backend/frontend codebase
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
pnpm build --filter @universo/store
pnpm build --filter @universo/template-mui
pnpm build --filter @universo/migration-guard-shared
pnpm build --filter @universo/schema-ddl

# Build authentication packages
pnpm build --filter @universo/auth-frontend
pnpm build --filter @universo/auth-backend

# Build domain frontend applications
pnpm build --filter @universo/admin-frontend
pnpm build --filter @universo/applications-frontend
pnpm build --filter @universo/metahubs-frontend
pnpm build --filter @universo/profile-frontend
pnpm build --filter @universo/start-frontend

# Build domain backend applications
pnpm build --filter @universo/admin-backend
pnpm build --filter @universo/applications-backend
pnpm build --filter @universo/metahubs-backend
pnpm build --filter @universo/profile-backend
pnpm build --filter @universo/start-backend

# Build core platform
pnpm build --filter @universo/core-backend
pnpm build --filter @universo/core-frontend
pnpm build --filter @universo/rest-docs
```

## Development

To run a specific application in development mode (watches for changes and rebuilds):

```bash
# Frontend packages
pnpm --filter @universo/admin-frontend dev
pnpm --filter @universo/applications-frontend dev
pnpm --filter @universo/auth-frontend dev
pnpm --filter @universo/metahubs-frontend dev
pnpm --filter @universo/profile-frontend dev
pnpm --filter @universo/start-frontend dev

# Backend packages
pnpm --filter @universo/admin-backend dev
pnpm --filter @universo/applications-backend dev
pnpm --filter @universo/auth-backend dev
pnpm --filter @universo/metahubs-backend dev
pnpm --filter @universo/profile-backend dev
pnpm --filter @universo/start-backend dev
```

**Note about resources:** For packages still using gulp (legacy build), watch scripts don't automatically copy SVG icons. If you add or modify SVG resources during development, run `pnpm build --filter <app>` to ensure they are properly copied to the dist directory. Packages using tsdown handle assets automatically.

---

_Universo Platformo | Apps Documentation_
