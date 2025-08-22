# @universo/template-mmoomm

MMOOMM template system for generating PlayCanvas applications with single-player and multiplayer support.

## Features

- **Dual Mode Support**: Single-player and multiplayer (Colyseus) game modes
- **UPDL Integration**: Process UPDL flow data into game objects using specialized handlers
- **Consistent Processing**: HandlerManager ensures identical UPDL processing between SP/MP modes
- **Modular Architecture**: Separate builders and handlers for different game modes and node types
- **Network Adaptation**: Automatic entity adaptation for multiplayer synchronization
- **TypeScript Support**: Full type safety with dual build (CommonJS + ESM)
- **PlayCanvas Integration**: Generate complete PlayCanvas applications with Colyseus client

## Installation

```bash
pnpm add @universo/template-mmoomm
```

## Usage

### Basic Usage

```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const html = await builder.build(flowData, {
  gameMode: 'singleplayer'
})
```

### Multiplayer Mode

```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const html = await builder.build(flowData, {
  gameMode: 'multiplayer',
  multiplayer: {
    serverHost: 'localhost',
    serverPort: 2567,
    roomName: 'game_room'
  }
})
```

## API Reference

### PlayCanvasMMOOMMBuilder

Main builder class that delegates to appropriate mode-specific builders.

#### Methods

- `build(flowData: IFlowData, options: BuildOptions): Promise<string>`
- `canHandle(flowData: IFlowData): boolean`
- `getTemplateInfo(): TemplateConfig`

### HandlerManager

Central coordinator for UPDL processing that ensures consistency between game modes.

#### Methods

- `processForSinglePlayer(flowData: IFlowData): ProcessedGameData`
- `processForMultiplayer(flowData: IFlowData): MultiplayerGameData`

#### Usage

```typescript
import { HandlerManager } from '@universo/template-mmoomm/playcanvas'

const handlerManager = new HandlerManager()

// Process for single-player mode
const spData = handlerManager.processForSinglePlayer(flowData)

// Process for multiplayer mode (includes network adaptations)
const mpData = handlerManager.processForMultiplayer(flowData)
```

### BuildOptions

Configuration options for building templates.

```typescript
interface BuildOptions {
  gameMode?: 'singleplayer' | 'multiplayer'
  multiplayer?: {
    serverHost?: string
    serverPort?: number
    roomName?: string
  }
}
```

### ProcessedGameData

Result of single-player UPDL processing.

```typescript
interface ProcessedGameData {
  entities: ComponentSnapshotMap[]
  spaces: SpaceData[]
  components: ComponentData[]
  actions: ActionData[]
  events: EventData[]
}
```

### MultiplayerGameData

Result of multiplayer UPDL processing (extends ProcessedGameData).

```typescript
interface MultiplayerGameData extends ProcessedGameData {
  networkEntities: NetworkEntity[]
  playerSpawnPoint: Transform
  authScreenData: AuthScreenData
  serverConfig: ColyseusServerConfig
}
```

## Architecture

The package is structured to support multiple 3D technologies with consistent UPDL processing:

```
src/
├── playcanvas/          # PlayCanvas-specific implementation
│   ├── builders/        # Mode-specific builders
│   │   ├── PlayCanvasMMOOMMBuilder.ts    # Main coordinator
│   │   ├── SinglePlayerBuilder.ts        # SP mode builder
│   │   └── MultiplayerBuilder.ts         # MP mode builder
│   ├── handlers/        # UPDL processing handlers
│   │   ├── HandlerManager.ts             # Central coordinator
│   │   ├── SpaceHandler/                 # Environment setup
│   │   ├── EntityHandler/                # Game objects
│   │   ├── ComponentHandler/             # Attachable behaviors
│   │   ├── EventHandler/                 # Real-time events
│   │   ├── ActionHandler/                # Player actions
│   │   ├── DataHandler/                  # Persistent data
│   │   └── UniversoHandler/              # Network gateway
│   ├── generators/      # HTML/Script generators
│   └── multiplayer/     # Colyseus integration
├── common/              # Shared utilities and types
└── index.ts             # Main exports
```

### Handler System

The handler system provides consistent UPDL processing:

1. **HandlerManager**: Coordinates all handlers and ensures SP/MP consistency
2. **Individual Handlers**: Process specific UPDL node types (Space, Entity, Component, etc.)
3. **Network Adaptation**: Automatic entity adaptation for multiplayer synchronization
4. **Mode Detection**: Intelligent detection of single-player vs multiplayer requirements

### Data Flow

```
UPDL Flow Data → HandlerManager → Individual Handlers → Processed Data → Builder → HTML
```

For multiplayer mode, additional network adaptations are applied:
- Entity network mapping and synchronization flags
- Auth screen generation from space configuration
- Server configuration from environment variables
- Player spawn point calculation

## Development

### Building

```bash
pnpm build              # Build all formats (CJS, ESM, Types)
pnpm build:cjs          # Build CommonJS only
pnpm build:esm          # Build ES Modules only
pnpm build:types        # Build TypeScript declarations only
```

### Development Mode

```bash
pnpm dev                # Watch mode for development
```

## License

MIT