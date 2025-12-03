# Current Architecture

## Brief Description

Analysis of the current Universo Platformo architecture in Alpha status (v0.21.0-alpha, July 2025), consisting of 6 working applications built on the Flowise 2.2.8 foundation, with detailed examination of existing packages and integration patterns.

## Contents

- [Existing Applications](#existing-applications)
- [Packages Analysis](#packages-analysis)
- [Integration Patterns](#integration-patterns)
- [Technical Debt](#technical-debt)
- [Migration Readiness](#migration-readiness)

## Existing Applications

### Current Application Structure

```
packages/
├── updl/                # UPDL Node System (7 high-level nodes)
├── publish-frontend/         # Publication Frontend (AR.js, PlayCanvas)
├── publish-backend/         # Publication Backend (workspace package)
├── profile-frontend/         # User Profile Frontend
├── profile-backend/         # Profile Backend (workspace package)
└── analytics-frontend/       # Quiz Analytics Frontend
```

### Application Details

#### UPDL System (`packages/updl/`)
**Purpose**: Core node system for creating Universo applications
**Key Features**:
- 7 abstract high-level nodes (Space, Entity, Component, Event, Action, Data, Universo)
- Visual flow editor for creating game logic
- Export capabilities to multiple platforms

#### Publication System (`packages/publish-frontend/`, `packages/publish-backend/`)
**Purpose**: Multi-platform export and publishing
**Key Features**:
- AR.js export (production ready)
- PlayCanvas export (ready for use)
- Template-based code generation
- MMOOMM template support

#### Profile Management (`packages/profile-frontend/`, `packages/profile-backend/`)
**Purpose**: User account and profile management
**Key Features**:
- User registration and authentication
- Profile customization
- Settings management

#### Analytics System (`packages/analytics-frontend/`)
**Purpose**: Quiz and interaction analytics
**Key Features**:
- Quiz result tracking
- User interaction analytics
- Performance metrics

## Packages Analysis

### Workspace Structure

```
packages/
├── universo-rest-docs/   # API documentation generator
├── components/         # Shared UI components
├── server/            # Core server functionality
└── ui/               # Frontend UI library
```

### Package Dependencies

#### Shared Components (`packages/flowise-components/`)
- Reusable UI components
- Common interfaces and types
- Validation utilities
- Storage utilities

#### Server Core (`packages/flowise-core-backend/base/`)
- Express.js server foundation
- Authentication middleware
- Database connections
- API routing

#### UI Library (`packages/flowise-core-frontend/base/`)
- React components
- Material-UI integration
- Custom themes
- Responsive design

## Integration Patterns

### Current Integration Approach

1. **Monolithic Flowise Base**: All applications built on shared Flowise foundation
2. **Workspace Packages**: Shared code through PNPM workspaces
3. **Template System**: Code generation for different platforms
4. **Database Integration**: Supabase for data persistence

### Communication Patterns

- **Frontend-Backend**: REST API calls
- **Inter-service**: Direct function calls (monolithic)
- **Real-time**: Supabase Realtime for live updates
- **File Storage**: Supabase Storage for assets

## Technical Debt

### Identified Issues

1. **Monolithic Architecture**: All applications share the same codebase
2. **Limited Scalability**: Single deployment unit
3. **Tight Coupling**: Applications depend on shared Flowise core
4. **Testing Complexity**: Difficult to test individual components

### Migration Challenges

1. **Data Migration**: Moving from shared database to microservices
2. **Authentication**: Implementing distributed auth
3. **State Management**: Transitioning from monolithic state
4. **Deployment**: Moving to containerized deployments

## Migration Readiness

### Assets for Migration

#### Reusable Components
- UPDL node definitions
- UI component library
- Authentication patterns
- Database schemas

#### Proven Patterns
- Template-based export
- Multi-platform support
- Real-time updates
- User management

### Migration Strategy

1. **Gradual Extraction**: Extract applications one by one
2. **API Standardization**: Define clear API contracts
3. **Data Isolation**: Separate database schemas
4. **Testing Strategy**: Comprehensive testing for each service

## Related Pages

- [Target Architecture](../target-architecture/README.md)
- [Implementation Plan](../implementation-plan/README.md)
- [Existing Applications](existing-apps.md)
- [Packages Analysis](packages-analysis.md)

## Status

- [x] Architecture analysis completed
- [x] Technical debt identified
- [x] Migration strategy defined
- [ ] Migration implementation planning

---
*Last updated: August 5, 2025*
