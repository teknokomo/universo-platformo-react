# Phase 1: MVP Universo MMOOMM (v0.22.0-alpha)

## Brief Description

The first phase of implementing the Universo Platformo roadmap, focused on creating a Minimum Viable Product (MVP) for Universo MMOOMM with basic game mechanics: resource system, ship management, and economy between worlds.

## Contents

- [Goals and Objectives](#goals-and-objectives)
- [Priority Applications](#priority-applications)
- [Technical Requirements](#technical-requirements)
- [Development Plan](#development-plan)
- [Readiness Criteria](#readiness-criteria)

## Goals and Objectives

### Primary Goal

Create a functioning MVP of a space MMO with basic game mechanics, demonstrating the potential of the Universo Platformo platform for creating complex gaming applications.

### Key Objectives

1. **Implement resource system** with realistic material physics
2. **Create ship management system** with basic customization
3. **Deploy economic system** with Inmo currency between three worlds
4. **Integrate with PlayCanvas** for 3D visualization
5. **Ensure stable operation** of all components

### Business Value

- **Capability Demonstration**: Show UPDL potential for creating complex applications
- **User Attraction**: Create engaging gaming experience
- **Technical Validation**: Verify architectural decisions
- **Development Foundation**: Lay groundwork for future features

## Priority Applications

### 1. Resources System (resources-frontend/srv)

**Priority**: Critical
**Development Time**: 4 weeks
**Team**: 2 developers (1 frontend, 1 backend)

#### Functional Requirements

**Frontend (resources-frontend)**:
- Inventory interface with weight/volume display
- Material density calculator
- Resource transfer system between locations
- Material type visualization

**Backend (resources-backend)**:
- Inventory management API
- Material physics calculations
- Weight/volume constraint validation
- Resource movement logging system

#### 16 Material Types

```typescript
interface MaterialType {
    id: string;
    name: string;
    density: number; // kg/m³
    baseValue: number; // base cost in Inmo
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    uses: string[];
}

const materials: MaterialType[] = [
    { id: 'hydrogen', name: 'Hydrogen', density: 0.09, baseValue: 1, rarity: 'common', uses: ['fuel'] },
    { id: 'helium', name: 'Helium', density: 0.18, baseValue: 2, rarity: 'common', uses: ['cooling'] },
    { id: 'carbon', name: 'Carbon', density: 2267, baseValue: 5, rarity: 'common', uses: ['structures'] },
    { id: 'oxygen', name: 'Oxygen', density: 1.43, baseValue: 3, rarity: 'common', uses: ['life_support'] },
    { id: 'silicon', name: 'Silicon', density: 2329, baseValue: 8, rarity: 'uncommon', uses: ['electronics'] },
    { id: 'iron', name: 'Iron', density: 7874, baseValue: 10, rarity: 'uncommon', uses: ['structures'] },
    { id: 'nickel', name: 'Nickel', density: 8908, baseValue: 15, rarity: 'uncommon', uses: ['alloys'] },
    { id: 'copper', name: 'Copper', density: 8960, baseValue: 12, rarity: 'uncommon', uses: ['wiring'] },
    { id: 'silver', name: 'Silver', density: 10490, baseValue: 50, rarity: 'rare', uses: ['electronics'] },
    { id: 'gold', name: 'Gold', density: 19300, baseValue: 100, rarity: 'rare', uses: ['premium_components'] },
    { id: 'platinum', name: 'Platinum', density: 21450, baseValue: 200, rarity: 'epic', uses: ['catalysts'] },
    { id: 'uranium', name: 'Uranium', density: 19050, baseValue: 500, rarity: 'epic', uses: ['nuclear_fuel'] },
    { id: 'titanium', name: 'Titanium', density: 4506, baseValue: 80, rarity: 'rare', uses: ['light_structures'] },
    { id: 'aluminum', name: 'Aluminum', density: 2700, baseValue: 6, rarity: 'uncommon', uses: ['light_components'] },
    { id: 'lithium', name: 'Lithium', density: 534, baseValue: 25, rarity: 'rare', uses: ['batteries'] },
    { id: 'rare_earth', name: 'Rare Earth', density: 7000, baseValue: 300, rarity: 'legendary', uses: ['special_tech'] }
];
```

#### API Specification

```typescript
// GET /api/v1/resources/inventory/:playerId
interface InventoryResponse {
    playerId: string;
    locations: {
        [locationId: string]: {
            type: 'ship' | 'station' | 'storage';
            name: string;
            materials: MaterialStack[];
            capacity: {
                maxMass: number;
                maxVolume: number;
                currentMass: number;
                currentVolume: number;
            };
        };
    };
}

// POST /api/v1/resources/transfer
interface TransferRequest {
    fromLocation: string;
    toLocation: string;
    materials: {
        materialId: string;
        quantity: number;
    }[];
}
```

### 2. Ships Management (ships-frontend/srv)

**Priority**: High
**Development Time**: 3 weeks
**Team**: 2 developers (1 frontend, 1 backend)

#### Functional Requirements

**Frontend (ships-frontend)**:
- Player fleet interface
- Basic ship configurator
- Ship task assignment system
- Ship status monitoring

**Backend (ships-backend)**:
- Ship management API
- Configuration and modules system
- Performance calculations
- Basic damage system

#### Ship Types

```typescript
interface ShipType {
    id: string;
    name: string;
    category: 'miner' | 'trader' | 'explorer' | 'fighter';
    baseStats: {
        cargoCapacity: number; // m³
        speed: number; // units/sec
        durability: number; // durability points
        energyCapacity: number; // energy units
    };
    moduleSlots: {
        engine: number;
        cargo: number;
        utility: number;
        weapon?: number;
    };
}

const shipTypes: ShipType[] = [
    {
        id: 'basic_miner',
        name: 'Basic Miner',
        category: 'miner',
        baseStats: { cargoCapacity: 100, speed: 50, durability: 100, energyCapacity: 200 },
        moduleSlots: { engine: 1, cargo: 2, utility: 1 }
    },
    {
        id: 'light_trader',
        name: 'Light Trader',
        category: 'trader',
        baseStats: { cargoCapacity: 200, speed: 80, durability: 80, energyCapacity: 150 },
        moduleSlots: { engine: 1, cargo: 3, utility: 1 }
    }
];
```

### 3. Economy System (economy-frontend/srv)

**Priority**: High
**Development Time**: 3 weeks
**Team**: 2 developers (1 frontend, 1 backend)

#### Functional Requirements

**Frontend (economy-frontend)**:
- Inmo wallet interface
- Inter-world exchange rate calculator
- Transaction history
- Basic trading analytics

**Backend (economy-backend)**:
- Balance management API
- Inter-world transfer system
- Dynamic pricing
- Economic analytics

#### World Economic Systems

```typescript
interface WorldEconomy {
    worldId: 'kubio' | 'konkordo' | 'triumfo';
    characteristics: {
        primaryIndustry: string;
        demandMultipliers: { [materialId: string]: number };
        supplyMultipliers: { [materialId: string]: number };
        volatility: number; // 0-1, affects price fluctuations
        tradingFee: number; // trading commission
    };
}

const worldEconomies: WorldEconomy[] = [
    {
        worldId: 'kubio',
        characteristics: {
            primaryIndustry: 'Heavy Industry',
            demandMultipliers: { iron: 1.5, titanium: 1.3, aluminum: 1.2 },
            supplyMultipliers: { carbon: 1.2, silicon: 0.8 },
            volatility: 0.3,
            tradingFee: 0.02
        }
    },
    {
        worldId: 'konkordo',
        characteristics: {
            primaryIndustry: 'High Technology',
            demandMultipliers: { rare_earth: 2.0, platinum: 1.8, gold: 1.5 },
            supplyMultipliers: { hydrogen: 1.1, helium: 1.1 },
            volatility: 0.5,
            tradingFee: 0.01
        }
    },
    {
        worldId: 'triumfo',
        characteristics: {
            primaryIndustry: 'Trading Hub',
            demandMultipliers: {}, // neutral demand
            supplyMultipliers: {}, // neutral supply
            volatility: 0.1,
            tradingFee: 0.005
        }
    }
];
```

## Technical Requirements

### Architectural Principles

1. **Microservices Architecture**: Each application as independent service
2. **API-first Approach**: All interactions through REST API
3. **Workspace Packages**: Code reuse between frontend and backend
4. **TypeScript**: Strict typing for all components

### Technology Stack

- **Frontend**: React 18+ + TypeScript + Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime for game events
- **Build**: Vite for frontend, tsc for backend
- **Testing**: Jest + React Testing Library

### PlayCanvas Integration

```typescript
interface PlayCanvasIntegration {
    resourceVisualization: {
        materialModels: string[]; // 3D material models
        inventoryUI: string; // UI inventory components
        transferAnimations: string[]; // resource transfer animations
    };
    shipVisualization: {
        shipModels: { [shipType: string]: string };
        customizationUI: string;
        movementSystem: string;
    };
    economyVisualization: {
        tradingUI: string;
        marketGraphs: string;
        transactionEffects: string[];
    };
}
```

## Development Plan

### Week 1-2: Infrastructure and Resources System

**Tasks**:
- Set up workspace structure for new applications
- Create basic architecture for resources-frontend/srv
- Implement API for material management
- Create inventory UI components

**Deliverables**:
- Working resources API
- Basic inventory interface
- Material density calculation system

### Week 3-4: Ships System

**Tasks**:
- Create ships-frontend/srv architecture
- Implement ship management API
- Integrate with resources system
- Create fleet management UI

**Deliverables**:
- Ship management API
- Fleet interface
- Basic ship configuration system

### Week 5-6: Economy System

**Tasks**:
- Create economy-frontend/srv architecture
- Implement Inmo currency system
- Create inter-world economy
- Integrate with resources and ships systems

**Deliverables**:
- Economic system API
- Wallet and trading interface
- Dynamic pricing system

### Week 7-8: Integration and Testing

**Tasks**:
- Integrate all systems
- Update PlayCanvas MMOOMM template
- Comprehensive testing
- Performance optimization

**Deliverables**:
- Fully integrated MVP
- Updated PlayCanvas template
- API documentation
- Testing results

### Week 9-10: Polish and Release

**Tasks**:
- Fix discovered bugs
- UI/UX improvements
- Prepare release documentation
- Deploy to staging and production

**Deliverables**:
- Release-ready MVP
- Complete documentation
- Release notes

## Readiness Criteria

### Functional Criteria

- [ ] **Resource System**: All 16 material types implemented with correct physics
- [ ] **Ship Management**: Minimum 2 ship types with basic customization
- [ ] **Economy**: Functioning Inmo currency between 3 worlds
- [ ] **Integration**: All systems work together without critical errors
- [ ] **PlayCanvas**: Updated template supports new mechanics

### Technical Criteria

- [ ] **API Coverage**: 100% API documentation coverage
- [ ] **Test Coverage**: Minimum 80% test coverage for critical functions
- [ ] **Performance**: API response time < 200ms for 95% of requests
- [ ] **Stability**: No critical bugs during week of testing
- [ ] **Security**: All APIs protected by authorization

### User Criteria

- [ ] **Usability**: Intuitive interfaces for all main functions
- [ ] **Responsiveness**: Adaptive design for different screen sizes
- [ ] **Feedback**: Clear feedback for all user actions
- [ ] **Error Handling**: Clear error messages
- [ ] **Help**: Basic help information for new users

### Business Criteria

- [ ] **Demo Ready**: Ready for demonstration to potential users
- [ ] **Scalability**: Architecture supports future expansion
- [ ] **Maintainability**: Code is easily maintained and extended
- [ ] **Documentation**: Complete technical and user documentation

## Related Pages

- [Implementation Plan](README.md)
- [Phase 2: Core Systems](phase-2-core.md)
- [MMOOMM Applications](../target-architecture/mmoomm-apps.md)
- [Technical Specifications](../technical-specifications/README.md)

## Status

- [x] Architecture planning
- [x] Requirements definition
- [x] Technical specifications creation
- [ ] Development start
- [ ] MVP implementation

---
*Last updated: August 5, 2025*
