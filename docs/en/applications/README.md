# Universo Platformo Applications

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

## Overview

The Universo Platformo applications directory (`packages/`) is a monorepo containing modular applications that extend the core Flowise platform. These applications work together to form a comprehensive ecosystem for creating AI agents, 3D/AR/VR spaces, and managing user interactions.

### Architectural Pattern

All applications follow a unified modular structure:

```
packages/
├── [application]-frt/    # Frontend package (React + TypeScript + Material-UI)
├── [application]-srv/    # Backend package (Node.js + Express + TypeORM)
└── [name]/              # Specialized package (UPDL, templates, utilities)
```

**Key Principles:**
- **Frontend packages** (`*-frt`): React 18, TypeScript, Material-UI, dual build (CJS + ESM)
- **Backend packages** (`*-srv`): Express.js, TypeORM, PostgreSQL, RESTful API
- **Minimal core changes**: Functionality added through packages without modifying Flowise
- **Shared types**: Centralized TypeScript definitions in `@universo/types`

## Application Categories

### 1️⃣ Core Platform (Flowise Core)

Core Flowise platform components adapted for Universo Platformo:

| Package | Purpose | Type |
|---------|---------|------|
| `flowise-components` | Flowise and UPDL nodes | Core |
| `flowise-server` | Platform backend with TypeORM | Backend |
| `flowise-ui` | Main UI application | Frontend |

### 2️⃣ Infrastructure Packages (Shared Infrastructure)

Reusable libraries and components:

| Package | Purpose | Export |
|---------|---------|--------|
| `@universo/types` | Shared TypeScript types | Types |
| `@universo/utils` | Utility functions | Utils |
| `@universo/api-client` | HTTP API client | Client |
| `@universo/i18n` | Internationalization system | i18next |
| `@universo/template-mui` | MUI components and themes | Components |
| `@flowise/chatmessage` | Chat components | React Components |
| `@flowise/store` | Redux store | Store |

### 3️⃣ Application Modules (Domain Applications)

#### 3.1 Content Management

**Workspaces (Uniks)** - Workspace management
- Packages: `@universo/uniks-frt`, `@universo/uniks-srv`
- Features: Workspace creation, member management, roles (owner/admin/editor/member)
- [Learn more →](uniks/README.md)

**Spaces** - Canvas/space management
- Packages: `@universo/spaces-frt`, `@universo/spaces-srv`
- Features: Flow graph creation and management, canvas persistence
- [Learn more →](spaces/README.md)

**Metaverses** - Metaverse management
- Packages: `@universo/metaverses-frt`, `@universo/metaverses-srv`
- Features: Virtual world and space organization
- [Learn more →](metaverse/README.md)

#### 3.2 Organization Management

**Organizations** - Three-tier organization structure
- Packages: `@universo/organizations-frt`, `@universo/organizations-srv`
- Architecture: Organizations → Departments → Positions
- Features: Complete data isolation, role management, hierarchy
- Status: ✅ Active (Q4 2024)

**Clusters** - Three-tier cluster structure
- Packages: `@universo/clusters-frt`, `@universo/clusters-srv`
- Architecture: Clusters → Domains → Resources
- Features: Resource management with cluster isolation
- Status: ✅ Active (Q4 2024)

**Projects** - Three-tier project structure
- Packages: `@universo/projects-frt`, `@universo/projects-srv`
- Architecture: Projects → Milestones → Tasks
- Features: Task and milestone management
- Status: ✅ Active (Q4 2024)

#### 3.3 User System

**Authentication** - Hybrid authentication
- Packages: `@universo/auth-frt`, `@universo/auth-srv`
- Technologies: Passport.js + Supabase JWT
- Features: Login, sessions, route protection
- [Learn more →](auth/README.md)

**Profile** - User profile management
- Packages: `@universo/profile-frt`, `@universo/profile-srv`
- Features: Email/password updates, user profile
- [Learn more →](profile/README.md)

**Analytics** - Analytics and reporting
- Package: `@universo/analytics-frt` (frontend only)
- Features: Quiz analytics, engagement metrics
- [Learn more →](analytics/README.md)

#### 3.4 Publishing and Export

**Publish System** - Export spaces to various platforms
- Packages: `@universo/publish-frt`, `@universo/publish-srv`
- Technologies: AR.js, PlayCanvas
- Features: Export UPDL graphs to public URLs
- [Learn more →](publish/README.md)

**Space Builder (Prompt-to-Flow)** - Graph generation from text
- Packages: `@universo/space-builder-frt`, `@universo/space-builder-srv`
- Features: LLM-powered UPDL graph generation from text descriptions
- [Learn more →](space-builder/README.md)

### 4️⃣ Specialized Packages (Specialized)

**UPDL (Universal Platform Definition Language)**
- Package: `updl`
- Purpose: 7 high-level nodes for 3D/AR/VR spaces
- Nodes: Space, Entity, Component, Event, Action, Data, Universo
- [Learn more →](updl/README.md)

**Template MMOOMM**
- Package: `@universo/template-mmoomm`
- Purpose: PlayCanvas template for Massively Multiplayer Online Metaverse
- Features: Colyseus multiplayer, physics, game scripts
- [Learn more →](template-mmoomm/README.md)

**Multiplayer Server**
- Package: `@universo/multiplayer-colyseus-srv`
- Technology: Colyseus WebSocket server
- Features: Real-time multiplayer for MMOOMM (up to 16 players)
- [Learn more →](multiplayer/README.md)

## All Applications Overview

| Application | Packages | Description | Status |
|------------|----------|-------------|--------|
| **Workspaces (Uniks)** | uniks-frt, uniks-srv | Workspace management | ✅ Active |
| **Organizations** | organizations-frt, organizations-srv | Three-tier organization structure | ✅ Active |
| **Clusters** | clusters-frt, clusters-srv | Three-tier cluster structure | ✅ Active |
| **Projects** | projects-frt, projects-srv | Three-tier project structure | ✅ Active |
| **Spaces** | spaces-frt, spaces-srv | Flow canvas management | ✅ Active |
| **Metaverses** | metaverses-frt, metaverses-srv | Metaverse management | ✅ Active |
| **Publish System** | publish-frt, publish-srv | Export to AR.js/PlayCanvas | ✅ Active |
| **Space Builder** | space-builder-frt, space-builder-srv | Text-to-graph generation (LLM) | ✅ Active |
| **Authentication** | auth-frt, auth-srv | Passport.js + Supabase auth | ✅ Active |
| **Profile** | profile-frt, profile-srv | User profile management | ✅ Active |
| **Analytics** | analytics-frt | Quiz analytics | ✅ Active |
| **UPDL** | updl | Node system for 3D/AR/VR | ✅ Active |
| **Template MMOOMM** | template-mmoomm | PlayCanvas MMO template | ✅ Active |
| **Multiplayer** | multiplayer-colyseus-srv | Colyseus multiplayer server | ✅ Active |

## Application Interactions

```
┌────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│                │       │                  │        │                  │
│  Flowise UI    │──────▶│  UPDL Nodes      │───────▶│  Publish System  │
│  (Editor)      │       │  (Space Graph)   │        │  (Export/Share)  │
│                │       │                  │        │                  │
└────────────────┘       └──────────────────┘        └────────┬─────────┘
                                                              │
                                                              ▼
                         ┌──────────────────┐        ┌──────────────────┐
                         │                  │        │                  │
                         │  Workspaces      │◀──────▶│  Authentication  │
                         │  (Uniks)         │        │  (Passport.js)   │
                         │                  │        │                  │
                         └────────┬─────────┘        └──────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌──────────────┐ ┌─────────┐ ┌────────────┐
            │ Organizations│ │ Clusters│ │  Projects  │
            └──────────────┘ └─────────┘ └────────────┘
```

**Key Integration Points:**
1. **Authentication**: All applications use unified Passport.js + Supabase system
2. **Workspace isolation**: Organizations, Clusters, Projects operate within Workspace context
3. **UPDL graph**: Created in Flowise UI → exported via Publish System
4. **TypeORM repositories**: All backend packages use unified DB through TypeORM

## Development Guidelines

### Adding a New Application

When creating a new module, follow this template:

1. **Frontend package** (`packages/[app]-frt/base/`):
   - TypeScript + React + Material-UI
   - Dual build (tsdown): CJS + ESM
   - i18n support (EN, RU)
   - React Query for API

2. **Backend package** (`packages/[app]-srv/base/`):
   - TypeScript + Express + TypeORM
   - Entities in `src/database/entities/`
   - Migrations in `src/database/migrations/postgres/`
   - Routes in `src/routes/`

3. **Integration**:
   - Register entities in `flowise-server/src/database/entities/index.ts`
   - Register migrations in `flowise-server/src/database/migrations/postgres/index.ts`
   - Add routes to `flowise-server`
   - Add to `flowise-ui` via imports

4. **Documentation**:
   - Create `README.md` in package
   - Add page to `docs/en/applications/`
   - Update `SUMMARY.md`

## Next Steps

Explore specific applications for deeper understanding:

- **[UPDL](updl/README.md)** - Universal Platform Definition Language
- **[Workspaces (Uniks)](uniks/README.md)** - Workspace management
- **[Publish System](publish/README.md)** - Publishing and content export
- **[Space Builder](space-builder/README.md)** - LLM-powered graph generation
- **[Multiplayer](multiplayer/README.md)** - Multiplayer server
- **[Authentication](auth/README.md)** - Authentication system

---

**Universo Platformo** - Comprehensive platform for creating AI agents and 3D/AR/VR metaverses
