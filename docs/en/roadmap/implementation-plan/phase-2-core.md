# Phase 2: Core Systems (v0.25.0-beta)

## Brief Description

The second phase of implementing the Universo Platformo roadmap, focused on creating social and technical systems, including corporations, enhanced authentication, and real-time multiplayer.

## Contents

-   [Goals and Objectives](#goals-and-objectives)
-   [Priority Applications](#priority-applications)
-   [Technical Requirements](#technical-requirements)
-   [Development Plan](#development-plan)
-   [Readiness Criteria](#readiness-criteria)

## Goals and Objectives

### Primary Goal

Create a fully functional social and technical infrastructure to support complex multiplayer interactions in Universo MMOOMM.

### Key Objectives

1. **Implement corporation system** with role hierarchy and asset management
2. **Create enhanced authentication** with game and platform account integration
3. **Deploy multiplayer system** with real-time synchronization
4. **Ensure security** and anti-cheat protection
5. **Scale to 5000+ players** simultaneously

### Business Value

-   **Social Interaction**: Create foundation for corporate relationships
-   **Technical Reliability**: Ensure stable operation under high load
-   **Security**: Protection against fraud and cheats
-   **Beta Readiness**: Preparation for public testing

## Priority Applications

### 1. Corporations System (corporations-frt/srv)

**Priority**: Critical
**Development Time**: 6 weeks
**Team**: 3 developers (1 frontend, 1 backend, 1 DevOps)

#### Functional Requirements

**Frontend (corporations-frt)**:

-   Corporation creation and management interface
-   Role and access rights system
-   Corporate asset management
-   Diplomatic interface

**Backend (corporations-srv)**:

-   Corporation management API
-   Role hierarchy system
-   Corporate finance management
-   Corporate action logging system

#### Corporation Structure

```typescript
interface Corporation {
    id: string
    name: string
    ticker: string // short name (3-5 characters)
    description: string
    foundedDate: Date
    headquarters: {
        worldId: string
        stationId?: string
    }
    members: CorporationMember[]
    assets: CorporationAssets
    diplomacy: DiplomaticRelations
    settings: CorporationSettings
}

interface CorporationMember {
    playerId: string
    joinDate: Date
    roles: string[]
    title?: string
    lastActive: Date
    contributionScore: number
}

interface CorporationRole {
    id: string
    name: string
    permissions: {
        // Member management
        canInviteMembers: boolean
        canKickMembers: boolean
        canPromoteMembers: boolean

        // Finance
        canAccessWallet: boolean
        canWithdrawFunds: boolean
        canSetTaxes: boolean

        // Assets
        canAccessHangars: boolean
        canMoveAssets: boolean
        canSellAssets: boolean

        // Diplomacy
        canDeclareWar: boolean
        canMakeAlliances: boolean
        canSetStandings: boolean

        // Administration
        canEditDescription: boolean
        canManageRoles: boolean
        canDisbandCorp: boolean
    }
}
```

#### Corporations: Assets Model

```typescript
interface CorporationAssets {
    inmoBalance: number
    ships: CorporationShip[]
    stations: CorporationStation[]
    resources: ResourceInventory
    contracts: CorporationContract[]
}
```

#### Corporations: API Specifications

```typescript
// POST /api/v1/corporations
interface CreateCorporationRequest {
    name: string
    ticker: string
    description: string
    headquarters: {
        worldId: string
        stationId?: string
    }
}

// POST /api/v1/corporations/:corpId/members
interface InviteMemberRequest {
    playerId: string
    message?: string
    initialRoles?: string[]
}

// PUT /api/v1/corporations/:corpId/members/:playerId/roles
interface UpdateMemberRolesRequest {
    roles: string[]
    reason?: string
}
```

### 2. Enhanced Authentication (auth-enhanced-frt/srv)

**Priority**: High
**Development Time**: 4 weeks
**Team**: 2 developers (1 backend, 1 security specialist)

#### Functional Requirements

**Frontend (auth-enhanced-frt)**:

-   Single Sign-On (SSO) interface
-   Game account management
-   Security settings
-   Two-factor authentication

**Backend (auth-enhanced-srv)**:

-   Supabase Auth integration
-   Game session management
-   Role and permission system
-   Security auditing

#### Authentication Architecture

```typescript
interface UniversoUser {
    // Platform account
    platformAccount: {
        id: string
        email: string
        emailVerified: boolean
        role: 'user' | 'developer' | 'moderator' | 'admin'
        createdAt: Date
        lastLogin: Date
    }

    // Game accounts
    gameAccounts: {
        [worldId: string]: {
            playerId: string
            characterName: string
            corporationId?: string
            securityStatus: number // -10.0 to +5.0
            skillPoints: number
            reputation: PlayerReputation
            createdAt: Date
            lastActive: Date
        }
    }

    // Verification
    verification: {
        emailVerified: boolean
        phoneVerified: boolean
        identityVerified: boolean // for corporation leaders
        twoFactorEnabled: boolean
    }

    // Security settings
    security: {
        loginHistory: LoginRecord[]
        suspiciousActivity: SecurityAlert[]
        ipWhitelist?: string[]
        sessionTimeout: number
    }
}

interface PlayerReputation {
    [factionId: string]: {
        standing: number // -10.0 to +10.0
        lastUpdate: Date
    }
}

interface LoginRecord {
    timestamp: Date
    ipAddress: string
    userAgent: string
    location?: string
    success: boolean
    failureReason?: string
}
```

### 3. Multiplayer System (multiplayer-frt/srv)

**Priority**: Critical
**Development Time**: 8 weeks
**Team**: 4 developers (2 backend, 1 frontend, 1 DevOps)

#### Functional Requirements

**Frontend (multiplayer-frt)**:

-   Online players list interface
-   Chat and communication system
-   Other players' activity display
-   Event notifications

**Backend (multiplayer-srv)**:

-   WebSocket server for real-time communication
-   Position synchronization system
-   Game event processing
-   Instance and zone system

#### Multiplayer Architecture

```typescript
interface MultiplayerState {
    worldId: string
    instanceId: string
    players: {
        [playerId: string]: PlayerState
    }
    entities: {
        ships: ShipState[]
        asteroids: AsteroidState[]
        stations: StationState[]
        npcs: NPCState[]
    }
    events: GameEvent[]
    lastUpdate: number
}

interface PlayerState {
    playerId: string
    characterName: string
    position: Vector3
    rotation: Quaternion
    velocity: Vector3
    currentShip: {
        shipId: string
        shipType: string
        health: number
        energy: number
        status: 'idle' | 'mining' | 'trading' | 'combat' | 'traveling'
    }
    corporationId?: string
    securityStatus: number
    lastUpdate: number
}
```

#### Multiplayer: Game Event Model

```typescript
interface GameEvent {
    id: string
    type: 'player_joined' | 'player_left' | 'ship_destroyed' | 'resource_mined' | 'trade_completed'
    timestamp: number
    data: any
    affectedPlayers: string[]
    worldId: string
    instanceId: string
}
```

#### Multiplayer: Real-time Communication

```typescript
interface WebSocketMessage {
    type: 'position_update' | 'game_event' | 'chat_message' | 'system_notification'
    timestamp: number
    senderId?: string
    data: any
}

interface PositionUpdate {
    playerId: string
    position: Vector3
    rotation: Quaternion
    velocity: Vector3
    timestamp: number
}

interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    channel: 'local' | 'corporation' | 'alliance' | 'private'
    message: string
    timestamp: number
    recipients?: string[]
}
```

## Technical Requirements

### Architectural Principles

1. **Event-driven Architecture**: Asynchronous communication through events
2. **Horizontal Scaling**: Ability to scale horizontally
3. **Fault Tolerance**: Resilience to component failures
4. **Security First**: Security as architectural priority

### Technology Stack

-   **Real-time**: Supabase Realtime + WebSocket
-   **Caching**: Redis for sessions and caching
-   **Message Queue**: Redis Pub/Sub for events
-   **Monitoring**: Prometheus + Grafana
-   **Logging**: Winston + ELK Stack

### Performance Targets

```typescript
interface PerformanceTargets {
    concurrentUsers: 5000 // simultaneous players
    responseTime: {
        api: 100 // ms for 95% requests
        websocket: 25 // ms latency
        database: 50 // ms for queries
    }
    throughput: {
        apiRequests: 10000 // RPS
        websocketMessages: 50000 // messages/sec
        gameEvents: 100000 // events/sec
    }
    availability: 99.9 // % uptime
}
```

## Development Plan

### Week 1-3: Corporations System - Foundation

**Tasks**:

-   Create corporations-frt/srv architecture
-   Implement basic corporation API
-   Role and permission system
-   Corporation creation interface

**Deliverables**:

-   Corporation creation and management API
-   Role system
-   Basic corporation interface

### Week 4-6: Corporations System - Advanced Features

**Tasks**:

-   Corporate assets and finances
-   Diplomatic system
-   Logging and audit system
-   Integration with existing systems

**Deliverables**:

-   Full-featured corporation system
-   Diplomatic interface
-   Asset management system

### Week 7-10: Enhanced Authentication

**Tasks**:

-   Supabase Auth integration
-   Game account system
-   Two-factor authentication
-   Security auditing

**Deliverables**:

-   Unified authentication system
-   Game and platform account integration
-   Security system

### Week 11-18: Multiplayer System

**Tasks**:

-   WebSocket server
-   Synchronization system
-   Game event processing
-   Chat system

**Deliverables**:

-   Real-time multiplayer
-   Communication system
-   Game state synchronization

### Week 19-20: Integration and Testing

**Tasks**:

-   System integration
-   Load testing
-   Performance optimization
-   Beta release preparation

**Deliverables**:

-   Fully integrated system
-   Load test results
-   Beta-ready version

## Readiness Criteria

### Functional Criteria

-   [ ] **Corporations**: Full-featured system with roles and assets
-   [ ] **Authentication**: Single sign-on and account management
-   [ ] **Multiplayer**: Stable synchronization of 1000+ players
-   [ ] **Security**: Protection against major attack types
-   [ ] **Performance**: Meeting target metrics

### Technical Criteria

-   [ ] **Scalability**: Horizontal scaling of services
-   [ ] **Monitoring**: Complete monitoring of all components
-   [ ] **Testing**: 90%+ test coverage for critical functions
-   [ ] **Documentation**: Complete technical documentation
-   [ ] **Security**: Passing security audit

### User Criteria

-   [ ] **UX**: Intuitive interfaces for all functions
-   [ ] **Performance**: Responsive interfaces without delays
-   [ ] **Reliability**: Stable operation without critical failures
-   [ ] **Communication**: Effective communication system

## Related Pages

-   [Phase 1: MVP](phase-1-mvp.md)
-   [Phase 3: Advanced Features](phase-3-advanced.md)
-   [Implementation Plan](README.md)
-   [Technical Specifications](../technical-specifications/README.md)

## Status

-   [x] Architecture planning
-   [x] Requirements definition
-   [x] Development start (core types package created)
-   [ ] Corporation implementation
-   [ ] Authentication implementation
-   [ ] Multiplayer implementation

---

_Last updated: August 5, 2025_
