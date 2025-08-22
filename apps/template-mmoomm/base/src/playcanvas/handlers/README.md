# MMOOMM Template Handlers

This directory contains the handler system for processing UPDL (Universal Platform Description Language) nodes in MMOOMM templates. The handlers provide consistent processing between single-player and multiplayer modes.

## Architecture Overview

```
HandlerManager (Coordinator)
├── SpaceHandler (Space/Environment setup)
├── EntityHandler (Game objects with networking)
├── ComponentHandler (Attachable behaviors)
├── EventHandler (Real-time events)
├── ActionHandler (Player/System actions)
├── DataHandler (Persistent data with sync)
└── UniversoHandler (Network gateway)
```

## Core Components

### HandlerManager

The `HandlerManager` is the central coordinator that:

- **Processes UPDL flow data** for both single-player and multiplayer modes
- **Ensures consistency** between SP and MP by using the same base handlers
- **Adapts entities for networking** in multiplayer mode
- **Generates configuration data** for auth screens and server connections

#### Key Methods

```typescript
// Process for single-player mode (no network adaptations)
processForSinglePlayer(flowData: IFlowData): ProcessedGameData

// Process for multiplayer mode (with network adaptations)
processForMultiplayer(flowData: IFlowData): MultiplayerGameData
```

#### Usage Example

```typescript
import { HandlerManager } from './HandlerManager'

const handlerManager = new HandlerManager()

// Single-player processing
const spData = handlerManager.processForSinglePlayer(flowData)

// Multiplayer processing (includes network entities, auth screen, server config)
const mpData = handlerManager.processForMultiplayer(flowData)
```

### Individual Handlers

Each handler specializes in processing specific UPDL node types:

#### SpaceHandler
- **Purpose**: Environment and world setup
- **Processes**: Space nodes (root, region, instance)
- **Generates**: Lighting, background, world switching logic

#### EntityHandler
- **Purpose**: Game objects with optional networking
- **Processes**: Entity nodes (ship, station, asteroid, gate, etc.)
- **Generates**: PlayCanvas entities with physics, rendering, and network sync

#### ComponentHandler
- **Purpose**: Attachable behaviors and systems
- **Processes**: Component nodes (inventory, trading, mineable, portal, weapon)
- **Generates**: Component attachment scripts and standalone components

#### EventHandler
- **Purpose**: Real-time event system
- **Processes**: Event nodes (collision, timer, player_joined, custom)
- **Generates**: Event listeners and network broadcasting logic

#### ActionHandler
- **Purpose**: Player and system actions
- **Processes**: Action nodes (move, teleport, send_message, custom)
- **Generates**: Action execution logic with network synchronization

#### DataHandler
- **Purpose**: Persistent data with synchronization
- **Processes**: Data nodes with scope (local, space, global)
- **Generates**: Data storage and real-time sync logic

#### UniversoHandler
- **Purpose**: Network gateway to Kiberplano ecosystem
- **Processes**: Universo nodes for WebSocket connections
- **Generates**: Network gateway with topic subscriptions

## Data Flow

### Single-Player Mode

```
UPDL Flow Data
    ↓
HandlerManager.processForSinglePlayer()
    ↓
Individual Handlers (SP mode)
    ↓
ProcessedGameData
    ↓
SinglePlayerBuilder
    ↓
PlayCanvas HTML
```

### Multiplayer Mode

```
UPDL Flow Data
    ↓
HandlerManager.processForMultiplayer()
    ↓
Individual Handlers (MP mode) + Network Adaptations
    ↓
MultiplayerGameData (includes NetworkEntities, AuthScreen, ServerConfig)
    ↓
MultiplayerBuilder
    ↓
PlayCanvas HTML + Colyseus Client
```

## Network Adaptations

When processing for multiplayer mode, the HandlerManager applies these adaptations:

### Entity Network Mapping

| Entity Type | Network Type | Networked | Description |
|-------------|--------------|-----------|-------------|
| `ship` | `ship` | ✅ | Player ships with real-time sync |
| `player` | `ship` | ✅ | Player entities (mapped to ships) |
| `vehicle` | `ship` | ✅ | Movable vehicles |
| `station` | `station` | ✅ | Interactive stations |
| `interactive` | `station` | ✅ | Interactive objects |
| `asteroid` | `asteroid` | ❌ | Static environment objects |
| `static` | `asteroid` | ❌ | Static decorative objects |
| `gate` | `gate` | ✅ | Portals and jump gates |
| `portal` | `gate` | ✅ | World transition points |

### Auth Screen Generation

The HandlerManager generates auth screen data from UPDL space configuration:

```typescript
{
  collectName: space.leadCollection?.collectName || true,
  title: space.name || 'Enter MMOOMM Space',
  description: space.description || 'Enter your name to join...',
  placeholder: 'Enter your name...'
}
```

### Server Configuration

Server configuration is generated from environment variables:

```typescript
{
  host: process.env.MULTIPLAYER_SERVER_HOST || 'localhost',
  port: parseInt(process.env.MULTIPLAYER_SERVER_PORT || '2567'),
  roomName: 'mmoomm',
  protocol: host === 'localhost' ? 'ws' : 'wss'
}
```

## Handler Development Guidelines

### Creating New Handlers

1. **Implement the processing interface**:
   ```typescript
   process(nodes: any[], options: BuildOptions = {}): string
   ```

2. **Generate PlayCanvas-compatible JavaScript**:
   - Use IIFE (Immediately Invoked Function Expression) for isolation
   - Include error handling and logging
   - Support both SP and MP modes

3. **Follow naming conventions**:
   - Handler classes: `PascalCase` (e.g., `EntityHandler`)
   - Methods: `camelCase` (e.g., `processEntity`)
   - Generated variables: `camelCase` with prefixes (e.g., `mmoEntity`)

### Component Architecture

Components can be used in two ways:

1. **Standalone Components**: Created independently and stored globally
2. **Entity Attachments**: Attached to specific entities during creation

Example component structure:
```
ComponentHandler/
├── components/          # Standalone component generators
│   ├── inventory.ts
│   ├── trading.ts
│   └── weapon.ts
└── attachments/         # Entity attachment generators
    ├── inventory.ts
    ├── trading.ts
    └── weapon.ts
```

### Error Handling

All handlers should include comprehensive error handling:

```typescript
try {
  // Handler logic
  return generatedScript
} catch (error) {
  console.error('[HandlerName] Error processing:', error)
  return '// Error in handler - see console'
}
```

## Integration with Builders

The HandlerManager integrates with the builder system:

### SinglePlayerBuilder Integration

```typescript
const processedData = this.handlerManager.processForSinglePlayer(flowData)
const script = this.generatePlayCanvasScript(processedData)
```

### MultiplayerBuilder Integration

```typescript
const multiplayerData = this.handlerManager.processForMultiplayer(flowData)
const authScreen = this.generateAuthScreen(multiplayerData.authScreenData)
const gameScript = this.generateGameScene(multiplayerData)
const colyseusScript = this.generateColyseusClient(multiplayerData.serverConfig)
```

## Testing and Validation

### Unit Testing

Each handler should be testable in isolation:

```typescript
const handler = new EntityHandler()
const result = handler.process(testEntities, { gameMode: 'singleplayer' })
expect(result).toContain('new pc.Entity')
```

### Integration Testing

The HandlerManager should be tested with complete UPDL flows:

```typescript
const handlerManager = new HandlerManager()
const spData = handlerManager.processForSinglePlayer(complexFlowData)
const mpData = handlerManager.processForMultiplayer(complexFlowData)

// Verify consistency
expect(spData.entities.length).toBe(mpData.entities.length)
expect(mpData.networkEntities.length).toBeGreaterThan(0)
```

## Performance Considerations

### Script Generation

- **Minimize generated code size**: Avoid unnecessary whitespace and comments in production
- **Use efficient patterns**: Prefer direct property access over complex lookups
- **Cache handler instances**: Reuse handler instances across multiple builds

### Memory Management

- **Clean up references**: Include cleanup handlers for entity destruction
- **Avoid memory leaks**: Use proper event listener cleanup
- **Optimize network sync**: Only sync necessary entity properties

## Future Extensions

The handler system is designed for extensibility:

### New Technologies

To add support for new 3D technologies (A-Frame, Babylon.js, etc.):

1. Create technology-specific handlers in `src/aframe/handlers/` or `src/babylonjs/handlers/`
2. Implement the same handler interfaces
3. Generate technology-specific code instead of PlayCanvas code

### New Node Types

To add support for new UPDL node types:

1. Create a new handler class (e.g., `WeatherHandler`)
2. Add it to the HandlerManager constructor
3. Include it in the processing pipeline
4. Update the builder integration

### Advanced Networking

For more sophisticated networking features:

1. Extend the network entity adaptation logic
2. Add new network message types to handlers
3. Implement custom synchronization strategies
4. Add support for different network topologies

This handler system provides a solid foundation for consistent UPDL processing across different game modes while maintaining flexibility for future enhancements.