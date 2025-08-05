# Existing Applications Analysis

## Brief Description

Detailed analysis of the 6 existing applications in Universo Platformo Alpha (v0.21.0-alpha), their functionality, architecture, and readiness for migration to the target microservices architecture.

## Contents

- [Application Overview](#application-overview)
- [Technical Architecture](#technical-architecture)
- [Feature Analysis](#feature-analysis)
- [Migration Assessment](#migration-assessment)
- [Recommendations](#recommendations)

## Application Overview

### 1. UPDL System (`apps/updl/`)

**Current Status**: Production Ready
**Technology Stack**: React + TypeScript + Custom Node Editor
**Purpose**: Visual flow editor for creating Universo applications

#### Key Features
- 7 high-level abstract nodes:
  - **Space**: Defines game worlds and environments
  - **Entity**: Game objects (ships, stations, asteroids)
  - **Component**: Object properties and behaviors
  - **Event**: Game events and triggers
  - **Action**: Player and system actions
  - **Data**: Game data and resources
  - **Universo**: Global settings and rules

#### Architecture
```typescript
interface UPDLNode {
    id: string;
    type: 'Space' | 'Entity' | 'Component' | 'Event' | 'Action' | 'Data' | 'Universo';
    properties: Record<string, any>;
    connections: NodeConnection[];
    position: { x: number; y: number };
}

interface NodeConnection {
    sourceNode: string;
    targetNode: string;
    sourceHandle: string;
    targetHandle: string;
}
```

### 2. Publication System (`apps/publish-frt/`, `apps/publish-srv/`)

**Current Status**: Production Ready
**Technology Stack**: React + Node.js + Template Engine
**Purpose**: Multi-platform export and publishing

#### Key Features
- **AR.js Export**: Production-ready AR applications
- **PlayCanvas Export**: 3D game applications
- **Template System**: Configurable export templates
- **MMOOMM Support**: Space MMO template

#### Export Templates
```typescript
interface ExportTemplate {
    name: string;
    platform: 'arjs' | 'playcanvas' | 'aframe';
    version: string;
    config: TemplateConfig;
    assets: AssetDefinition[];
    scripts: ScriptDefinition[];
}

interface MMOOMMTemplate extends ExportTemplate {
    gameLogic: {
        mining: MiningConfig;
        trading: TradingConfig;
        navigation: NavigationConfig;
    };
}
```

### 3. Profile Management (`apps/profile-frt/`, `apps/profile-srv/`)

**Current Status**: Beta
**Technology Stack**: React + Express.js + Supabase
**Purpose**: User account and profile management

#### Key Features
- User registration and authentication
- Profile customization
- Settings management
- Integration with Supabase Auth

#### Data Model
```typescript
interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    avatar?: string;
    preferences: UserPreferences;
    gameAccounts: GameAccount[];
    createdAt: Date;
    updatedAt: Date;
}

interface GameAccount {
    worldId: string;
    characterName: string;
    level: number;
    experience: number;
    lastLogin: Date;
}
```

### 4. Analytics System (`apps/analytics-frt/`)

**Current Status**: Alpha
**Technology Stack**: React + Chart.js + Supabase
**Purpose**: Quiz and interaction analytics

#### Key Features
- Quiz result tracking
- User interaction analytics
- Performance metrics
- Data visualization

## Technical Architecture

### Current Deployment Model

```
┌─────────────────────────────────────────┐
│           Flowise Monolith              │
├─────────────────────────────────────────┤
│  apps/updl/        apps/publish-frt/    │
│  apps/profile-frt/ apps/analytics-frt/  │
│  apps/publish-srv/ apps/profile-srv/    │
├─────────────────────────────────────────┤
│         Shared Packages                 │
│  components/ server/ ui/ api-docs/      │
├─────────────────────────────────────────┤
│           Infrastructure                │
│  Supabase DB + Auth + Storage          │
└─────────────────────────────────────────┘
```

### Database Schema

```sql
-- Current shared database structure
CREATE SCHEMA public;

-- Users and authentication (Supabase Auth)
-- Profiles
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- UPDL Flows
CREATE TABLE updl_flows (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    name VARCHAR(255),
    description TEXT,
    flow_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Published Applications
CREATE TABLE published_apps (
    id UUID PRIMARY KEY,
    flow_id UUID REFERENCES updl_flows(id),
    platform VARCHAR(50),
    status VARCHAR(50),
    url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics Data
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    app_id UUID REFERENCES published_apps(id),
    event_type VARCHAR(100),
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

## Feature Analysis

### Strengths

1. **UPDL System**:
   - Unique high-level abstraction
   - Visual flow editor
   - Multi-platform export capability

2. **Template Architecture**:
   - Reusable export templates
   - Platform-specific optimizations
   - MMOOMM game template

3. **Integration**:
   - Supabase for backend services
   - Real-time capabilities
   - File storage integration

### Limitations

1. **Scalability**:
   - Monolithic deployment
   - Shared database
   - Limited horizontal scaling

2. **Maintainability**:
   - Tight coupling between applications
   - Shared dependencies
   - Complex testing

3. **Performance**:
   - Single point of failure
   - Resource contention
   - Limited caching

## Migration Assessment

### Migration Readiness by Application

#### High Readiness (Easy Migration)
- **analytics-frt**: Simple frontend, minimal dependencies
- **profile-frt**: Standard CRUD operations
- **profile-srv**: Well-defined API surface

#### Medium Readiness (Moderate Migration)
- **publish-frt**: Template dependencies need refactoring
- **publish-srv**: Complex template engine

#### Low Readiness (Complex Migration)
- **updl**: Core system with many dependencies

### Migration Strategy

#### Phase 1: Extract Simple Applications
1. **analytics-frt** → `analytics-frt` microservice
2. **profile-srv** → `profile-srv` microservice
3. **profile-frt** → Update to use new profile API

#### Phase 2: Extract Publishing System
1. **publish-srv** → `publish-srv` microservice
2. **Template Engine** → Separate service
3. **publish-frt** → Update to use new APIs

#### Phase 3: Extract UPDL System
1. **Node Registry** → Separate service
2. **Flow Engine** → Separate service
3. **updl** → Update to use new services

## Recommendations

### Immediate Actions

1. **API Standardization**: Define clear API contracts for each application
2. **Database Isolation**: Create separate schemas for each domain
3. **Testing Strategy**: Implement comprehensive testing for each component

### Migration Preparation

1. **Dependency Analysis**: Map all inter-application dependencies
2. **Data Migration Planning**: Plan data migration strategy
3. **Rollback Strategy**: Prepare rollback procedures

### Long-term Goals

1. **Microservices Architecture**: Complete migration to independent services
2. **Container Deployment**: Docker-based deployment
3. **Service Mesh**: Implement service discovery and communication

## Related Pages

- [Current Architecture](README.md)
- [Packages Analysis](packages-analysis.md)
- [Target Architecture](../target-architecture/README.md)
- [Migration Strategy](../implementation-plan/migration-strategy.md)

## Status

- [x] Application analysis completed
- [x] Migration readiness assessed
- [x] Migration strategy defined
- [ ] Migration implementation planning

---
*Last updated: August 5, 2025*
