# Universo MMOOMM Applications

## Brief Description

Detailed description of specialized applications for implementing Universo MMOOMM game mechanics - a space MMO with an economic system based on resource extraction, inter-world trading, and corporate interactions.

## Contents

- [Game Mechanics](#game-mechanics)
- [Social Systems](#social-systems)
- [Technical Systems](#technical-systems)
- [PlayCanvas Integration](#playcanvas-integration)
- [Data Architecture](#data-architecture)

## Game Mechanics

Applications implementing core Universo MMOOMM game mechanics:

- **resources-frt/srv**: Resource system with 16 material types
- **ships-frt/srv**: Ship and fleet management
- **economy-frt/srv**: Economy with Inmo currency
- **mining-frt/srv**: Industrial laser mining
- **stations-frt/srv**: Space stations and production
- **navigation-frt/srv**: Navigation between worlds
- **security-frt/srv**: Space security system
- **combat-frt/srv**: PvP combat system
- **skills-frt/srv**: Skills and progression system
- **sovereignty-frt/srv**: Territorial warfare system
- **industry-frt/srv**: Manufacturing and production

### Resources Management System

#### resources-frt/srv
**Purpose**: Resource management with material density physics

**Key Features**:
- Inventory interface with weight/volume display
- 16 material types with realistic physics
- Resource transfer between locations
- Material density calculations

**16 Material Types**:
1. **Hydrogen** (0.09 kg/m³) - Engine fuel
2. **Helium** (0.18 kg/m³) - Cooling agent
3. **Carbon** (2267 kg/m³) - Construction material
4. **Oxygen** (1.43 kg/m³) - Life support systems
5. **Silicon** (2329 kg/m³) - Electronics and processors
6. **Iron** (7874 kg/m³) - Primary construction metal
7. **Nickel** (8908 kg/m³) - Alloys and coatings
8. **Copper** (8960 kg/m³) - Electrical wiring
9. **Silver** (10490 kg/m³) - High-tech electronics
10. **Gold** (19300 kg/m³) - Premium components
11. **Platinum** (21450 kg/m³) - Catalysts and engines
12. **Uranium** (19050 kg/m³) - Nuclear fuel
13. **Titanium** (4506 kg/m³) - Lightweight structures
14. **Aluminum** (2700 kg/m³) - Light components
15. **Lithium** (534 kg/m³) - Batteries and energy storage
16. **Rare Earth** (7000 kg/m³) - Specialized technologies

### Security & Combat System

#### security-frt/srv
**Purpose**: Space security system

**Key Features**:
- Security zone classification (High-sec, Low-sec, Null-sec)
- CONCORD system (space police)
- Automatic punishment for aggression in secure zones
- Player security status system

**Security Zones**:
```typescript
interface SecurityZone {
    zoneId: string;
    securityLevel: number; // 1.0 (High-sec) to 0.0 (Null-sec)
    concordResponse: {
        enabled: boolean;
        responseTime: number; // seconds until CONCORD arrival
        punishment: 'ship_destruction' | 'security_status_loss' | 'none';
    };
    restrictions: {
        pvpAllowed: boolean;
        podKilling: boolean;
        structureDestruction: boolean;
    };
}
```

#### combat-frt/srv
**Purpose**: PvP combat system

**Key Features**:
- Targeting and attack system
- Damage and defense calculations
- Ship loss system upon destruction
- Escape pod mechanics
- Corporation warfare system

### Skills & Progression System

#### skills-frt/srv
**Purpose**: Character skills and progression system

**Key Features**:
- Real-time skill training
- Skill training queue
- Skill effects on game mechanics
- Implant system for training acceleration

### Sovereignty & Territorial Warfare

#### sovereignty-frt/srv
**Purpose**: Territorial warfare and system control

**Key Features**:
- Territory capture and control
- Influence and control systems
- Orbital structures (similar to EVE's skyhooks)
- Sovereignty upgrades
- Alliance warfare mechanics

**Sovereignty System**:
```typescript
interface SovereigntySystem {
    systemId: string;
    controllingAlliance?: string;
    influenceLevel: number; // 0-100%
    structures: {
        sovereigntyHub?: SovereigntyHub;
        orbitalSkyhooks: OrbitalSkyhook[];
        defensiveStructures: DefensiveStructure[];
    };
    upgrades: {
        militaryIndex: number;
        industrialIndex: number;
        strategicIndex: number;
    };
    contestation: {
        isContested: boolean;
        attackingAlliance?: string;
        contestationLevel: number;
        vulnerabilityWindow: TimeWindow;
    };
}

interface SovereigntyHub {
    id: string;
    health: number;
    reinforcementTimer?: Date;
    upgrades: SovereigntyUpgrade[];
    resources: {
        power: number;
        workforce: number;
        reagents: number;
    };
}
```

### Industry & Manufacturing

#### industry-frt/srv
**Purpose**: Manufacturing and production system

**Key Features**:
- Production lines and factories
- Research and development
- Blueprint system
- Supply chain management
- Resource processing

**Manufacturing System**:
```typescript
interface ManufacturingSystem {
    blueprints: {
        [itemId: string]: Blueprint;
    };
    productionLines: ProductionLine[];
    research: {
        materialEfficiency: ResearchProject[];
        timeEfficiency: ResearchProject[];
        invention: InventionProject[];
    };
    supplyChains: SupplyChain[];
}

interface Blueprint {
    id: string;
    itemProduced: string;
    materials: MaterialRequirement[];
    productionTime: number;
    skillRequirements: SkillRequirement[];
    facilityRequirements: FacilityType[];
}
```

## Social Systems

### Corporations System

#### corporations-frt/srv
**Purpose**: Corporations and organizations

**Key Features**:
- Corporation creation and management
- Role hierarchy and access rights
- Corporate assets and finances
- Tax and dividend system

### Diplomacy System

#### diplomacy-frt/srv
**Purpose**: Diplomatic relations

**Key Features**:
- Alliance and hostility system
- Negotiations and treaties
- War declarations and ceasefires
- Diplomatic reputation

### Trading System

#### trading-frt/srv
**Purpose**: Advanced trading system

**Key Features**:
- Trading platforms and auctions
- Contract system
- Logistics and delivery
- Market analytics and forecasts

**Advanced Trading System**:
```typescript
interface TradingSystem {
    marketOrders: {
        buyOrders: MarketOrder[];
        sellOrders: MarketOrder[];
        priceHistory: PricePoint[];
        volume24h: number;
    };
    contracts: {
        courier: CourierContract[];
        auction: AuctionContract[];
        exchange: ExchangeContract[];
        loan: LoanContract[];
    };
    regionalMarkets: {
        [regionId: string]: RegionalMarket;
    };
}
```

## Technical Systems

### Enhanced Authentication

#### auth-enhanced-frt/srv
**Purpose**: Enhanced authentication system

**Key Features**:
- Integration of game and platform accounts
- Single Sign-On (SSO) between systems
- Identity verification for corporations
- Reputation and trust system

### Multiplayer System

#### multiplayer-frt/srv
**Purpose**: Real-time multiplayer

**Key Features**:
- Ship position synchronization
- Collision and interaction handling
- Instance and zone system
- Network traffic optimization

### Security & Monitoring

#### security-frt/srv
**Purpose**: Security and anti-cheat protection

**Key Features**:
- Cheat and exploit detection
- Ban and warning system
- Suspicious activity monitoring
- Economy manipulation protection

## UPDL Node Integration

### Detailed Mapping Schema

Each high-level UPDL node corresponds to specific applications and game mechanics:

```typescript
interface UPDLServiceMapping {
    Space: {
        services: ['navigation-srv', 'stations-srv', 'security-srv', 'sovereignty-srv'];
        description: 'Game worlds, security zones, and spatial systems';
        gameLogic: {
            worlds: ['kubio', 'konkordo', 'triumfo'];
            securityZones: ['high-sec', 'low-sec', 'null-sec'];
            starGates: 'inter-world transitions';
            stations: 'space bases and outposts';
            sovereignty: 'territorial control systems';
        };
    };
    Entity: {
        services: ['ships-srv', 'resources-srv', 'mining-srv', 'industry-srv'];
        description: 'Game objects and entities';
        gameLogic: {
            ships: 'player and NPC ships';
            asteroids: 'mining asteroids';
            resources: 'materials and items';
            structures: 'stations and buildings';
            factories: 'production facilities';
        };
    };
    Component: {
        services: ['ships-srv', 'stations-srv', 'skills-srv', 'industry-srv'];
        description: 'Object components and modules';
        gameLogic: {
            shipModules: 'engines, weapons, shields';
            stationModules: 'production lines';
            skillBonuses: 'skill bonuses';
            implants: 'character implants';
            blueprints: 'manufacturing blueprints';
        };
    };
    Event: {
        services: ['multiplayer-srv', 'combat-srv', 'trading-srv', 'sovereignty-srv'];
        description: 'Game events and triggers';
        gameLogic: {
            combatEvents: 'attacks, destructions, damage';
            tradeEvents: 'deals, contracts, auctions';
            socialEvents: 'wars, alliances, diplomacy';
            systemEvents: 'resource respawn, NPC activity';
            sovereigntyEvents: 'territory capture, structure attacks';
        };
    };
    Action: {
        services: ['combat-srv', 'trading-srv', 'diplomacy-srv', 'mining-srv', 'industry-srv'];
        description: 'Player and system actions';
        gameLogic: {
            playerActions: 'attack, mine, trade, move';
            corporateActions: 'declare war, create alliance';
            economicActions: 'place orders, make contracts';
            industrialActions: 'manufacture, research';
            sovereigntyActions: 'capture territory, deploy structures';
        };
    };
    Data: {
        services: ['resources-srv', 'economy-srv', 'analytics-enhanced-srv'];
        description: 'Game data and metrics';
        gameLogic: {
            gameState: 'world state';
            playerData: 'progress, skills, reputation';
            economicData: 'prices, trade volumes';
            analytics: 'player behavior metrics';
        };
    };
    Universo: {
        services: ['workflow-engine-srv', 'node-registry-srv', 'security-srv'];
        description: 'Global rules and configuration';
        gameLogic: {
            gameRules: 'PvP, economy, progression rules';
            balancing: 'ship, weapon, skill balance';
            worldSettings: 'world and zone settings';
            systemConfig: 'server and service configuration';
        };
    };
}
```

## PlayCanvas Integration

### Template Engine Integration

All MMOOMM applications integrate with PlayCanvas through the enhanced Template Engine:

```typescript
interface MMOOMMTemplate {
    name: 'universo-mmoomm';
    version: string;
    gameLogic: {
        resourceSystem: ResourceSystemConfig;
        economySystem: EconomySystemConfig;
        shipsSystem: ShipsSystemConfig;
        multiplayerSystem: MultiplayerSystemConfig;
        combatSystem: CombatSystemConfig;
        sovereigntySystem: SovereigntySystemConfig;
    };
    assets: {
        ships: ShipAsset[];
        stations: StationAsset[];
        materials: MaterialAsset[];
        ui: UIAsset[];
        effects: EffectAsset[];
    };
    scripts: {
        clientScripts: ClientScript[];
        serverScripts: ServerScript[];
    };
}
```

### Real-time Synchronization

```typescript
class PlayCanvasMMOOMMClient {
    private supabase: SupabaseClient;
    private gameState: MultiplayerState;
    
    async syncPlayerPosition(position: Vector3, rotation: Quaternion) {
        await this.supabase
            .from('player_positions')
            .upsert({
                player_id: this.playerId,
                world_id: this.worldId,
                x: position.x,
                y: position.y,
                z: position.z,
                qx: rotation.x,
                qy: rotation.y,
                qz: rotation.z,
                qw: rotation.w,
                timestamp: Date.now()
            });
    }
    
    subscribeToWorldEvents() {
        this.supabase
            .channel(`world:${this.worldId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'world_events'
            }, this.handleWorldEvent.bind(this))
            .subscribe();
    }
}
```

## Data Architecture

### Database Schemas

```sql
-- Game worlds and players
CREATE SCHEMA universo_worlds;
CREATE TABLE universo_worlds.players (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    world_id VARCHAR(50),
    character_name VARCHAR(100),
    position_x DECIMAL(15,6),
    position_y DECIMAL(15,6),
    position_z DECIMAL(15,6),
    current_ship_id UUID,
    inmo_balance DECIMAL(15,2),
    reputation INTEGER DEFAULT 0,
    security_status DECIMAL(3,1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sovereignty and territorial control
CREATE SCHEMA universo_sovereignty;
CREATE TABLE universo_sovereignty.systems (
    id VARCHAR(50) PRIMARY KEY,
    controlling_alliance_id UUID,
    influence_level DECIMAL(5,2),
    military_index INTEGER DEFAULT 0,
    industrial_index INTEGER DEFAULT 0,
    strategic_index INTEGER DEFAULT 0
);

-- Industry and manufacturing
CREATE SCHEMA universo_industry;
CREATE TABLE universo_industry.blueprints (
    id UUID PRIMARY KEY,
    item_id VARCHAR(100),
    material_requirements JSONB,
    production_time INTEGER,
    skill_requirements JSONB
);
```

## Related Pages

- [Core Platform Applications](core-platform-apps.md)
- [Microservices Design](microservices-design.md)
- [Phase 1: MVP](../implementation-plan/phase-1-mvp.md)
- [Technical Specifications](../technical-specifications/README.md)

## Development Status

- [x] Game mechanics design
- [x] Data architecture definition
- [/] Technical specifications creation
- [ ] MVP development start
- [ ] PlayCanvas integration

---
*Last updated: August 5, 2025*
