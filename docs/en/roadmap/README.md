# Universo Platformo Roadmap

## Brief Description

The roadmap defines the strategic development of Universo Platformo from its current Alpha status to a full-featured platform for creating Universo MMOOMM and other 3D/AR/VR applications. This document describes the architectural evolution from 6 existing applications to a comprehensive ecosystem of 20+ microservices.

## Contents

- [Current Architecture](#current-architecture)
- [Target Architecture](#target-architecture)
- [Implementation Plan](#implementation-plan)
- [Applications](#applications)
- [Technical Specifications](#technical-specifications)
- [Milestones](#milestones)

## Current Architecture

**Status**: Alpha achieved (v0.21.0-alpha, July 2025)

Universo Platformo currently consists of 6 working applications built on top of the Flowise 2.2.8 foundation:

### Existing Applications

```
packages/
├── updl/                # UPDL Node System (7 high-level nodes)
├── publish-frt/         # Publication Frontend (AR.js, PlayCanvas)
├── publish-srv/         # Publication Backend (workspace package)
├── profile-frt/         # User Profile Frontend
├── profile-srv/         # Profile Backend (workspace package)
└── analytics-frt/       # Quiz Analytics Frontend
```

### Key Achievements

- ✅ **UPDL System**: 7 abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
- ✅ **Multi-technology Export**: AR.js (production), PlayCanvas (ready)
- ✅ **Template Architecture**: Reusable export templates
- ✅ **MMOOMM MVP**: Basic space MMO with laser mining
- ✅ **Resource System**: Realistic material physics with density

## Target Architecture

**Vision**: Microservices ecosystem of 20+ applications for creating full-featured Universo MMOOMM

### Application Categories

1. **Game Mechanics** (8 applications)
   - Resources, economy, ships, stations, mining, navigation

2. **Social Systems** (6 applications)
   - Corporations, diplomacy, trading, communications

3. **Technical Systems** (6 applications)
   - Enhanced authentication, multiplayer, security, analytics

4. **Platform Applications** (4 applications)
   - Workflow engine, node registry, API Gateway, templates

### Architectural Principles

- **Microservices Architecture**: Each application as independent service
- **API-first Approach**: All interactions through well-defined APIs
- **Event-driven Architecture**: Asynchronous communication via Supabase Realtime
- **Workspace Packages**: Reusable components between applications

## Implementation Plan

### Phase 1: MVP Universo MMOOMM (v0.22.0-alpha) - Q2 2025

**Goal**: Create basic game functionality

**Priority Applications**:
- `resources-frt/srv` - Resource system with material density
- `ships-frt/srv` - Ship management
- `economy-frt/srv` - Basic economy between worlds

**Readiness Criteria**:
- [ ] Working MVP with basic game mechanics
- [ ] Integration with PlayCanvas template
- [ ] Economy between 3 worlds (Kubio, Konkordo, Triumfo)

### Phase 2: Core Systems (v0.25.0-beta) - Q3 2025

**Goal**: Social and technical systems

**Applications**:
- `corporations-frt/srv` - Corporations and organizations
- `auth-enhanced-frt/srv` - Enhanced authentication
- `multiplayer-frt/srv` - Real-time multiplayer

### Phase 3: Advanced Features (v1.0.0) - Q4 2025

**Goal**: Complete game mechanics ecosystem

**Applications**:
- `stations-frt/srv` - Space stations
- `trading-frt/srv` - Advanced trading
- `diplomacy-frt/srv` - Diplomatic relations

### Phase 4: Ecosystem (v1.5.0+) - 2026+

**Goal**: Microservices platform

**Applications**:
- `workflow-engine-srv` - Chatflow engine
- `node-registry-srv` - Node registry
- `api-gateway-srv` - API Gateway

## Applications

### Game Mechanics

Applications implementing core Universo MMOOMM game mechanics:

- **Resources**: System with 16 material types and realistic physics
- **Economy**: Inmo currency with different economic systems
- **Ships**: Fleet management with customization
- **Stations**: Space bases and production
- **Mining**: Industrial laser mining
- **Navigation**: Star gates between worlds

### Social Systems

Applications for player interaction:

- **Corporations**: Organizations with role hierarchy
- **Diplomacy**: Alliances, conflicts, negotiations
- **Trading**: Auctions, contracts, logistics
- **Communications**: In-game communication and forums

### Technical Systems

Applications for platform technical support:

- **Authentication**: Integration of game and platform accounts
- **Multiplayer**: Real-time synchronization
- **Security**: Protection against cheats and exploits
- **Analytics**: Metrics and behavioral analysis

## Technical Specifications

### Technology Stack

- **Frontend**: React + TypeScript + Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **Package Manager**: PNPM workspaces
- **3D Engines**: PlayCanvas, AR.js

### Architectural Patterns

- **API Gateway**: Single entry point for all requests
- **Event Bus**: Asynchronous communication via Supabase Realtime
- **Workspace Packages**: Reusable components
- **Template Engine**: Code generation for different platforms

## Milestones

### Upcoming Releases

- **v0.22.0-alpha** (Q2 2025): MVP game mechanics
- **v0.25.0-beta** (Q3 2025): Social systems
- **v1.0.0** (Q4 2025): First stable release

### Long-term Goals

- **v1.5.0** (2026): Microservices architecture
- **v2.0.0** (2027): TON blockchain integration
- **v3.0.0** (2028): Kiberplano functionality

## Related Pages

- [Current Architecture](current-architecture/README.md)
- [Target Architecture](target-architecture/README.md)
- [Implementation Plan](implementation-plan/README.md)
- [Applications](applications/README.md)
- [Technical Specifications](technical-specifications/README.md)
- [Milestones](milestones/README.md)

## Implementation Status

- [x] Current architecture analysis
- [x] Target architecture planning
- [/] Documentation creation
- [ ] Phase 1 implementation start

---
*Last updated: August 5, 2025*
