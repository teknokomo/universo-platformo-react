# MMOOMM PlayCanvas Template

The MMOOMM (Massive Multiplayer Online Object Mining Management) template provides a comprehensive space MMO environment built on PlayCanvas Engine 2.9.0. This template demonstrates advanced game mechanics including industrial laser mining, physics-based space flight, and real-time inventory management.

## Overview

The MMOOMM template transforms UPDL (Universal Platform Definition Language) nodes into a fully functional space MMO experience. Players control spacecraft equipped with industrial laser mining systems, navigate through asteroid fields, and manage cargo in a persistent virtual universe.

### Key Features

-   **Industrial Laser Mining System**: Auto-targeting laser mining with 3-second cycles
-   **Advanced Entity System**: Ships, asteroids, stations, gates with networking capabilities
-   **Physics-Based Flight**: 6DOF movement with realistic space physics
-   **Real-time Inventory Management**: Comprehensive resource management system with shared templates
-   **Interactive HUD**: Mining progress, cargo status, and system indicators
-   **Modular Architecture**: Template-first design with specialized handlers

## Architecture

### Template Structure

```
mmoomm/playcanvas/
├── PlayCanvasBuilder.ts           # High-level PlayCanvas builder
├── PlayCanvasMMOOMMBuilder.ts     # MMOOMM template implementation
├── config.ts                      # Template configuration
├── handlers/                      # UPDL node processors
│   ├── ActionHandler/             # Action handling module
│   ├── ComponentHandler/          # Component handling (components/, attachments/)
│   ├── DataHandler/               # Data handling module
│   ├── EntityHandler/             # Entity handling (entityTypes/)
│   │   ├── entityTypes/           # Specialized entity implementations
│   │   │   ├── ship.ts            # Player spacecraft with laser mining
│   │   │   ├── asteroid.ts        # Mineable asteroid objects
│   │   │   ├── station.ts         # Trading and docking facilities
│   │   │   ├── gate.ts            # Inter-system teleportation
│   │   │   ├── player.ts          # Network-aware player entities
│   │   │   ├── interactive.ts     # Custom interaction objects
│   │   │   ├── vehicle.ts         # Alternative movement entities
│   │   │   └── static.ts          # Environmental objects
│   │   └── utils.ts               # Entity utilities
│   ├── EventHandler/              # Event handling module
│   ├── SpaceHandler/              # Space handling module
│   ├── UniversoHandler/           # Universo handling module
│   ├── shared/                    # Shared components and utilities
│   │   ├── inventoryTemplate.ts   # Inventory system shared template
│   │   ├── README.md              # Detailed shared components documentation
│   │   └── README-RU.md           # Russian documentation
│   └── index.ts                   # Handlers export
├── scripts/                       # PlayCanvas scripts system
│   ├── BaseScript.ts              # Abstract base class
│   ├── RotatorScript.ts           # Rotation animation script
│   └── index.ts                   # Scripts module exports
└── index.ts                       # MMOOMM PlayCanvas exports
```

### Handler System

The MMOOMM template uses a modular handler system where each UPDL node type has a dedicated processor:

-   **SpaceHandler**: Processes Space nodes for MMO environments (root, region, instance)
-   **EntityHandler**: Manages entity creation with specialized types for space gameplay
-   **ComponentHandler**: Handles component attachment and UPDL overrides
-   **EventHandler**: Processes real-time events and networking
-   **ActionHandler**: Manages network actions and player interactions
-   **DataHandler**: Handles data synchronization across clients
-   **UniversoHandler**: Manages network gateway setup and protocols

### Shared Components

The MMOOMM template includes shared components that provide reusable implementations for common game mechanics, ensuring consistency and eliminating code duplication across handlers.

#### Inventory System

The **Inventory System** is a comprehensive resource management solution that supports:

-   **Mining Operations**: Store resources collected from asteroid mining (asteroidMass, crystals, etc.)
-   **Trading Mechanics**: Manage cargo for station-based commerce with capacity tracking
-   **Crafting Systems**: Handle materials for item production and equipment upgrades
-   **Quest Systems**: Track quest items and deliverables without capacity limits
-   **Fuel Management**: Monitor consumable resources for ship operations

**Key Features:**

-   Configurable capacity limits (default: 20m³ cargo hold)
-   Support for any string-based item types
-   Optional logging and event integration for UI updates
-   Shared template approach eliminates code duplication
-   Integration with UPDL Component nodes and Entity types

**Usage Patterns:**

-   **UPDL Components**: Automatic attachment via `attachments/inventory.ts`
-   **Entity Integration**: Direct integration in ship.ts and other entity types
-   **Standalone Components**: Independent processing via `components/inventory.ts`

For detailed technical documentation, API reference, and integration examples, see [Shared Components Documentation](./handlers/shared/README.md).

## Entity System

### Available Entity Types

#### Ship

Player-controlled spacecraft with comprehensive systems:

-   **Laser Mining System**: Industrial laser with auto-targeting and state machine
-   **Inventory Management**: 20m³ cargo hold with real-time capacity tracking
-   **Physics Integration**: Collision detection, rigidbody dynamics
-   **Camera Controller**: Third-person camera following ship movement
-   **Movement System**: WASD+QZ controls with 6DOF flight mechanics

#### Asteroid

Mineable objects with resource extraction:

-   **Resource Yield**: Configurable resource amounts (default 1.5m³ per cycle)
-   **Destruction Mechanics**: Asteroids destroyed when fully mined
-   **Collision System**: Ray-casting for laser targeting validation
-   **Visual Feedback**: Material changes during mining process

#### Station

Trading posts and docking facilities:

-   **Commerce System**: Resource trading and cargo management
-   **Docking Mechanics**: Ship-to-station interaction protocols
-   **Inventory Exchange**: Bulk cargo transfer capabilities

#### Gate

Inter-system teleportation portals:

-   **Teleportation System**: Instant travel between locations
-   **Network Synchronization**: Multi-client portal state management
-   **Access Control**: Permission-based portal usage

### Entity Features

-   **Modular Architecture**: Each entity type has dedicated logic in `entityTypes/` directory
-   **Component Integration**: Seamless integration with UPDL Component nodes
-   **Network Support**: Built-in networking capabilities for multiplayer scenarios
-   **Physics Integration**: Collision detection, rigidbody dynamics, spatial relationships
-   **Memory Management**: Automatic cleanup and reference management

## Laser Mining System

### System Architecture

The laser mining system implements a sophisticated state machine with four primary states:

1. **Idle**: Default state, waiting for activation
2. **Targeting**: Scanning for valid targets within range
3. **Mining**: Active resource extraction with visual laser beam
4. **Collecting**: Resource collection and inventory integration

### Technical Implementation

#### State Machine

```javascript
laserSystem: {
    state: 'idle',           // Current system state
    currentTarget: null,     // Active mining target
    miningStartTime: 0,      // Mining cycle start timestamp
    cycleProgress: 0,        // Mining progress (0-1)
    laserBeam: null         // Visual laser beam entity
}
```

#### Configuration

-   **Max Range**: 75 units (optimal targeting distance)
-   **Mining Duration**: 3000ms (3-second cycles)
-   **Resource Yield**: 1.5m³ per successful mining cycle
-   **Visual Effects**: Red emissive laser beam with fade animations

#### Target Detection

-   **Range Validation**: Targets must be within 75-unit radius
-   **Line-of-Sight**: Ray-casting validation for clear targeting
-   **Priority Algorithm**: Distance and angle-based target selection
-   **Auto-Targeting**: Automatic target acquisition and tracking

### Integration Points

The laser system integrates with multiple game systems:

-   **SpaceControls**: Space key activation triggers laser system
-   **MMOEntities**: Global entity registry for target scanning
-   **SpaceHUD**: Real-time mining progress and status display
-   **Inventory System**: Automatic resource collection and storage
-   **Physics System**: Ray-casting for target validation

## Game Mechanics

### Mining Workflow

1. **Activation**: Player presses space key to activate laser system
2. **Target Acquisition**: System scans for asteroids within 75-unit range
3. **Laser Engagement**: Visual laser beam appears, connecting ship to target
4. **Resource Extraction**: 3-second mining cycle with progress indication
5. **Collection**: Resources automatically added to ship inventory
6. **Cycle Completion**: System returns to idle state for next activation

### Movement System

-   **6DOF Flight**: Full six degrees of freedom movement in 3D space
-   **WASD Controls**: Forward/backward and strafe movement
-   **QZ Controls**: Vertical movement (up/down)
-   **Physics Integration**: Realistic momentum and inertia
-   **Camera Following**: Third-person camera maintains optimal viewing angle

### Inventory Management

-   **Cargo Capacity**: 20m³ maximum storage capacity
-   **Real-time Tracking**: Live capacity monitoring and percentage display
-   **Item Management**: Support for multiple resource types
-   **Overflow Protection**: Mining disabled when cargo hold is full

## Configuration

### Template Configuration

The MMOOMM template is configured through `config.ts`:

```typescript
export const MMOOMMTemplateConfig: TemplateConfig = {
    id: 'mmoomm',
    name: 'playcanvasTemplates.mmoomm.name',
    description: 'playcanvasTemplates.mmoomm.description',
    version: '0.1.0',
    technology: 'playcanvas',
    supportedNodes: ['Space', 'Entity', 'Component', 'Event', 'Action', 'Data', 'Universo'],
    features: [
        'playcanvas-2.9.0',
        'networking',
        'real-time-sync',
        'multi-user',
        'universo-gateway',
        'websocket-protocol',
        'mmoomm-systems',
        'script-system',
        'modular-scripts'
    ]
}
```

### Usage

```typescript
import { PlayCanvasBuilder } from './builders'

const builder = new PlayCanvasBuilder()
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'Space Mining Demo',
    templateId: 'mmoomm'
})

console.log(result.html) // Generated PlayCanvas HTML
```

## Development

### Adding New Entity Types

1. Create new entity file in `entityTypes/` directory
2. Implement entity-specific logic and systems
3. Register entity type in `ENTITY_GENERATORS` mapping
4. Add networking support if required

### Extending Game Mechanics

1. Modify existing entity logic in respective `entityTypes/` files
2. Update handler processing in relevant handler modules
3. Integrate with existing systems (HUD, inventory, physics)
4. Test multiplayer synchronization if applicable

### Script System Integration

The template includes a simple script system for reusable behaviors:

```typescript
import { RotatorScript } from './scripts'

// Create rotation script for demo objects
const rotator = RotatorScript.createDefault()
```

## Technical Requirements

-   **PlayCanvas Engine**: Version 2.9.0 or higher
-   **Browser Support**: Modern browsers with WebGL support
-   **Network Protocol**: WebSocket for real-time multiplayer
-   **Memory**: Optimized for efficient entity management

## Future Enhancements

-   **Trading System**: Enhanced commerce between stations
-   **Multiplayer Networking**: Real-time player synchronization
-   **Advanced Mining**: Multiple laser types and mining strategies
-   **Territory Control**: Player-owned stations and resource claims
-   **Quest System**: Mission-based gameplay progression

---

_Universo Platformo | MMOOMM PlayCanvas Template Documentation_
