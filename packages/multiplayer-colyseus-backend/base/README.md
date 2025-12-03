# @universo/multiplayer-colyseus-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Colyseus multiplayer framework

Real-time multiplayer server for Universo MMOOMM space gameplay experiences.

## Package Information

- **Version**: 0.1.0
- **Type**: Multiplayer Server Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Colyseus + WebSocket transport

## Key Features

### Real-time Multiplayer
- Up to 16 concurrent players per room
- WebSocket-based real-time communication
- Server-authoritative state management
- Low-latency position and action synchronization

### MMOOMM Gameplay
- **Mining System**: Server-validated asteroid mining mechanics
- **Trading System**: Station-based resource selling with credit tracking
- **Entity Management**: Synchronized asteroids, stations, and gates
- **Inventory System**: Real-time resource tracking and validation

### Technical Features
- **State Synchronization**: Type-safe schemas with Colyseus
- **Anti-cheat Protection**: Server-side position and action validation
- **Graceful Scaling**: Room-based architecture with automatic load balancing
- **Development Tools**: Hot reload support and comprehensive testing

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/multiplayer-colyseus-backend build
```

## Usage

### Development Server
```bash
# Start development server with hot reload
pnpm --filter @universo/multiplayer-colyseus-backend dev

# Server starts on ws://localhost:2567
# Supports automatic restart on file changes
```

### Production Deployment
```bash
# Build TypeScript to JavaScript
pnpm --filter @universo/multiplayer-colyseus-backend build

# Start production server
pnpm --filter @universo/multiplayer-colyseus-backend start
```

### Integration with PlayCanvas
```typescript
// Client-side connection example
import { Client } from 'colyseus.js'

const client = new Client('ws://localhost:2567')
const room = await client.joinOrCreate('mmoomm', { 
  playerName: 'SpaceExplorer',
  startPosition: { x: 0, y: 2, z: 0 }
})

// Handle state updates
room.onStateChange((state) => {
  // Update game world with synchronized state
  updatePlayers(state.players)
  updateEntities(state.entities)
})
```

## API Reference

### Room Configuration
- **Room ID**: `mmoomm`
- **Max Players**: 16 concurrent players
- **Default Port**: 2567 (configurable)
- **Transport**: WebSocket with fallback options

### Connection Options
```typescript
interface JoinOptions {
  playerName?: string        // Player display name
  name?: string             // Alternative name field (compatibility)
  startPosition?: {         // Optional spawn position
    x: number
    y: number  
    z: number
  }
  entities?: EntityData[]   // UPDL entity initialization data
}

// Connection example
const room = await client.joinOrCreate('mmoomm', {
  playerName: 'SpaceCommander',
  startPosition: { x: 10, y: 2, z: -15 }
})
```

### Message Protocol

#### Client → Server Messages
```typescript
// Player movement and rotation
room.send('updateTransform', {
  x: number,
  y: number, 
  z: number,
  rotX: number,
  rotY: number,
  rotZ: number
})

// Start mining action at current position
room.send('startMining', {
  targetEntityId?: string  // Optional specific asteroid ID
})

// Sell all inventory at nearest trading station
room.send('sellAll', {
  stationId?: string      // Optional specific station ID
})
```

#### Server → Client Updates
```typescript
// State synchronization via Colyseus schemas
room.onStateChange((state) => {
  // Real-time player updates
  state.players.forEach((player, sessionId) => {
    updatePlayerPosition(sessionId, player.x, player.y, player.z)
    updatePlayerInventory(sessionId, player.inventory, player.credits)
  })
  
  // Entity state updates
  state.entities.forEach((entity, entityId) => {
    updateEntityState(entityId, entity.type, entity.position, entity.data)
  })
})
```

## Architecture

### Core Components
```
src/
├── index.ts              # Server initialization and setup
├── rooms/
│   └── MMOOMMRoom.ts     # Main multiplayer room logic
├── schemas/              # Type-safe state definitions
│   ├── PlayerSchema.ts   # Player state structure
│   ├── EntitySchema.ts   # Game entity definitions
│   └── MMOOMMRoomState.ts # Complete room state
├── integration/          # External system integrations
├── utils/                # Shared utilities
└── tests/                # Test suites
```

### State Management Architecture
```typescript
// Room state hierarchy
MMOOMMRoomState {
  players: Map<string, PlayerSchema>     // All connected players
  entities: Map<string, EntitySchema>    // Game world entities
  currentPlayers: number                 // Active player count
  roomSettings: RoomConfig               // Room configuration
}

// Player state schema
PlayerSchema {
  name: string          // Display name
  x, y, z: number      // 3D position
  rotX, rotY, rotZ: number  // Rotation
  inventory: number     // Resource count
  credits: number       // Trading currency
  lastActivity: number  // Anti-idle timestamp
}
```

### Game Systems
- **Movement System**: Server-validated position updates with bounds checking
- **Mining System**: Proximity-based asteroid resource extraction
- **Trading System**: Station-based inventory conversion to credits
- **Anti-cheat**: Server-authoritative validation of all player actions

## Integration

### PlayCanvas Template Integration
This server automatically integrates with MMOOMM PlayCanvas templates when:
- Space has `collectLeadName=true` property
- Connected Space exists in the metaverse
- Multiplayer mode is enabled in game settings

### UPDL Entity Integration
```typescript
// Initialize room with UPDL entities
const room = await client.joinOrCreate('mmoomm', {
  entities: [
    { id: 'asteroid-1', type: 'asteroid', position: [10, 0, 20], data: { resources: 100 } },
    { id: 'station-1', type: 'station', position: [0, 0, 0], data: { tradingRates: { ore: 10 } } }
  ]
})
```

## Configuration

### Environment Variables
```bash
# Server Configuration
PORT=2567                              # Server port
MULTIPLAYER_SERVER_PORT=2567           # Alternative port variable
COLYSEUS_PORT=2567                     # Colyseus-specific port
NODE_ENV=development                   # Environment mode

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379       # For scaling with Redis presence

# Monitoring
COLYSEUS_MONITOR_PORT=2568             # Admin panel port
COLYSEUS_MONITOR_SECRET=your-secret    # Admin authentication
```

### Room Settings
```typescript
// Configurable room parameters
const roomConfig = {
  maxClients: 16,           // Maximum players per room
  patchRate: 20,            // State updates per second (50ms)
  simulationInterval: 16.6, // Physics tick rate (60fps)
  autoDispose: true,        // Auto-cleanup empty rooms
  presence: 'redis'         // Scaling with Redis (optional)
}
```

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- TypeScript 5+
- Redis (optional, for scaling)

### Available Scripts
```bash
# Development
pnpm dev                # Start with hot reload
pnpm build              # Compile TypeScript
pnpm start              # Start production server
pnpm clean              # Clean build directory

# Testing
pnpm test               # Run Jest test suite
pnpm test:watch         # Run tests in watch mode

# Utilities
pnpm type-check         # TypeScript type checking
```

### Development Workflow
```bash
# Start development server
pnpm --filter @universo/multiplayer-colyseus-backend dev

# In another terminal, test connection
# Use Colyseus monitor at http://localhost:2568 (if enabled)
# Or connect with game client to ws://localhost:2567
```

### Project Structure
```
src/
├── index.ts              # Server entry point
├── rooms/
│   └── MMOOMMRoom.ts     # Game room implementation  
├── schemas/              # Colyseus state schemas
│   ├── PlayerSchema.ts   # Player data structure
│   ├── EntitySchema.ts   # Game entity structure
│   └── MMOOMMRoomState.ts # Room state container
├── integration/          # External integrations
│   └── updl.ts          # UPDL entity loading
├── utils/               # Shared utilities
│   ├── validation.ts    # Input validation
│   └── gameLogic.ts     # Game mechanics
└── tests/               # Test files
    ├── room.test.ts     # Room functionality tests
    └── integration.test.ts # Integration tests
```

## Testing

### Test Suite
```bash
# Run all tests
pnpm --filter @universo/multiplayer-colyseus-backend test

# Run with coverage
pnpm --filter @universo/multiplayer-colyseus-backend test -- --coverage

# Run specific test file
pnpm test -- room.test.ts
```

### Test Coverage
- **Room Lifecycle**: Creation, join/leave, disposal
- **Message Handling**: All client message types
- **State Synchronization**: Player and entity updates
- **Game Logic**: Mining, trading, movement validation
- **Integration**: UPDL entity loading, PlayCanvas compatibility

### Example Test
```typescript
describe('MMOOMMRoom', () => {
  test('players can join and receive initial state', async () => {
    const room = new MMOOMMRoom()
    await room.onCreate({})
    
    const client = { sessionId: 'test-123' }
    room.onJoin(client, { playerName: 'TestPlayer' })
    
    expect(room.state.players.has('test-123')).toBe(true)
    expect(room.state.currentPlayers).toBe(1)
  })
})
```

## Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN pnpm install --prod

# Copy compiled code
COPY dist/ ./dist/

# Expose port
EXPOSE 2567

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:2567/health || exit 1

CMD ["node", "dist/index.js"]
```

### Production Considerations
- **Load Balancing**: Use Redis presence for multi-instance scaling
- **Monitoring**: Enable Colyseus monitor for real-time room statistics
- **Logging**: Structured logging for production debugging
- **Security**: Rate limiting and input validation
- **Performance**: Optimize patch rates based on game requirements

## Monitoring

### Built-in Statistics
```typescript
// Access room statistics
console.log(`Active rooms: ${gameServer.presence.totalRooms}`)
console.log(`Connected clients: ${gameServer.presence.totalClients}`)

// Per-room metrics
room.onMessage('getStats', (client) => {
  client.send('stats', {
    players: room.state.currentPlayers,
    entities: room.state.entities.size,
    uptime: Date.now() - room.createdAt
  })
})
```

### Health Endpoints
```typescript
// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: gameServer.presence.totalRooms,
    clients: gameServer.presence.totalClients,
    uptime: process.uptime()
  })
})
```

## Related Packages
- [`@universo/template-mmoomm`](../template-mmoomm/base/README.md) - PlayCanvas game template
- [`@universo/spaces-frontend`](../spaces-frontend/base/README.md) - Space management frontend
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metaverse management platform*
