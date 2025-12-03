# MMOOMM Template Package

> **📦 Package**: `@universo/template-mmoomm`  
> **🏗️ Architecture**: Modular template system for MMOOMM functionality  
> **🎯 Purpose**: Reusable MMOOMM template generation for PlayCanvas and other 3D technologies

The MMOOMM Template Package is a dedicated workspace package that provides modular, reusable template generation for MMOOMM (Massively Multiplayer Online Object-Oriented Metaverse) functionality. This package was extracted from the `publish-frontend` application to improve modularity and promote code reuse.

## Package Overview

### Architecture

```
@universo/template-mmoomm/
├── src/
│   ├── playcanvas/           # PlayCanvas-specific implementations
│   │   ├── builders/         # Template builders
│   │   ├── handlers/         # Node handlers
│   │   ├── multiplayer/      # Colyseus multiplayer support
│   │   ├── generators/       # Code generators
│   │   ├── scripts/          # Embedded game scripts
│   │   └── utils/            # PlayCanvas utilities
│   ├── common/               # Shared utilities and types
│   └── i18n/                 # Internationalization
└── dist/                     # Compiled output (CJS/ESM)
```

### Build System

The package features a **dual build system** supporting both CommonJS and ES Modules:

-   **CommonJS**: `dist/cjs/` - For Node.js environments
-   **ES Modules**: `dist/esm/` - For modern bundlers and browsers
-   **TypeScript**: `dist/types/` - Type definitions for development

### Key Features

-   **Modular Template System**: Organized by technology (PlayCanvas) with extensible architecture
-   **Multiplayer Support**: Integrated Colyseus client-server architecture
-   **UPDL Integration**: Full support for UPDL flow processing and object extraction
-   **Type Safety**: Complete TypeScript support with shared type definitions
-   **Internationalization**: Built-in i18n support for multiple languages

## PlayCanvas Implementation

### Builders

The PlayCanvas builders provide template generation for MMOOMM games:

#### PlayCanvasMMOOMMBuilder

Main builder class that generates complete MMOOMM game experiences:

```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const html = builder.build(flowData, options)
```

**Features:**

-   **Single-player Mode**: Traditional MMOOMM gameplay with ship controls, mining, and trading
-   **Multiplayer Mode**: Colyseus-based multiplayer with real-time synchronization
-   **UPDL Integration**: Processes UPDL flows to extract game objects and configurations
-   **Entity Management**: Handles ships, stations, asteroids, and gates with proper physics

### Handlers

Node handlers process UPDL nodes and convert them to game objects:

-   **SpaceHandler**: Processes Space nodes for scene creation
-   **EntityHandler**: Handles Entity nodes (ships, stations, etc.)
-   **ComponentHandler**: Processes Component nodes for game mechanics
-   **DataHandler**: Manages Data nodes for game state

### Multiplayer Support

Integrated Colyseus multiplayer system:

#### Client Integration

```typescript
// Embedded in generated HTML
const client = new Colyseus.Client(serverUrl)
const room = await client.joinOrCreate('mmoomm')
```

#### Server Architecture

-   **MMOOMMRoom**: Main game room with player management
-   **PlayerSchema**: Player state synchronization
-   **EntitySchema**: Game object state management
-   **Real-time Updates**: Transform, mining, and trading synchronization

### Generators

Code generators create the final HTML and JavaScript:

-   **HTML Generator**: Creates the complete HTML document with embedded scripts
-   **JavaScript Generator**: Generates game logic and UPDL integration
-   **Multiplayer Generator**: Creates Colyseus client integration code

## Integration with publish-frontend

The `publish-frontend` application consumes this package as a dependency:

### Package Dependencies

```json
{
    "dependencies": {
        "@universo/template-mmoomm": "workspace:*"
    }
}
```

### Usage in publish-frontend

```typescript
// In publish-frontend builders
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

export class PlayCanvasBuilder extends AbstractTemplateBuilder {
    async build(flowData: any, options: BuildOptions): Promise<string> {
        const mmoommBuilder = new PlayCanvasMMOOMMBuilder()
        return mmoommBuilder.build(flowData, options)
    }
}
```

## Development

### Building the Package

```bash
# Build all formats
pnpm build

# Build specific formats
pnpm build:cjs    # CommonJS
pnpm build:esm    # ES Modules
pnpm build:types  # TypeScript definitions
```

### Development Mode

```bash
# Watch mode for development
pnpm dev
```

### Linting

```bash
# Check code quality
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

## API Reference

### Main Exports

```typescript
// Main package entry point
export * from './playcanvas'
export * from './common'

// Key interfaces
export type { ITemplateBuilder, BuildOptions, ProcessedGameData } from './common/types'
```

### PlayCanvas Exports

```typescript
// Builders
export { PlayCanvasMMOOMMBuilder } from './builders/PlayCanvasMMOOMMBuilder'

// Handlers
export { SpaceHandler } from './handlers/SpaceHandler'
export { EntityHandler } from './handlers/EntityHandler'
export { ComponentHandler } from './handlers/ComponentHandler'

// Multiplayer
export { MMOOMMRoom } from './multiplayer/MMOOMMRoom'
export { PlayerSchema } from './multiplayer/schemas/PlayerSchema'

// Utilities
export { UPDLProcessor } from './utils/UPDLProcessor'
```

## Migration from publish-frontend

This package was extracted from the `publish-frontend` application to improve modularity:

### Before (Monolithic)

```
publish-frontend/
├── src/builders/templates/mmoomm/playcanvas/
│   ├── PlayCanvasMMOOMMBuilder.ts
│   ├── handlers/
│   └── multiplayer/
```

### After (Modular)

```
publish-frontend/                    # Consumer
└── package.json
    └── "@universo/template-mmoomm": "workspace:*"

template-mmoomm/                # Provider
└── src/
    ├── playcanvas/
    ├── common/
    └── i18n/
```

### Benefits

-   **Reusability**: Template can be used by other applications
-   **Maintainability**: Clear separation of concerns
-   **Testing**: Isolated testing of template functionality
-   **Versioning**: Independent versioning of template features

## Future Extensions

The modular architecture allows for easy extension:

### Additional Technologies

-   **Three.js**: WebGL-based 3D rendering
-   **Babylon.js**: Game engine integration
-   **A-Frame**: VR/AR support

### Enhanced Features

-   **Advanced Physics**: More sophisticated physics simulation
-   **AI Integration**: NPC behavior and pathfinding
-   **Custom Shaders**: Advanced visual effects
-   **Mobile Optimization**: Touch controls and performance

## Contributing

When contributing to the template package:

1. **Maintain Modularity**: Keep technology-specific code in appropriate directories
2. **Type Safety**: Ensure all exports have proper TypeScript definitions
3. **Testing**: Add tests for new template features
4. **Documentation**: Update this README for new functionality
5. **Backward Compatibility**: Maintain compatibility with existing consumers
