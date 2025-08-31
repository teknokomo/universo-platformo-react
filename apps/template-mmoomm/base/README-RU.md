# @universo/template-mmoomm

MMOOMM template system for generating PlayCanvas applications with single-player and multiplayer support.

См. также: Создание новых приложений/пакетов (рекомендации)

- ../../../docs/ru/universo-platformo/shared-guides/creating-apps.md
## Features

- Dual Mode Support: Single-player and multiplayer (Colyseus) game modes
- UPDL Integration: Process UPDL flow data into game objects
- Modular Architecture: Separate builders and handlers per mode
- TypeScript Support: Dual build (CommonJS + ESM)
- PlayCanvas Integration: Full PlayCanvas applications
- Render Component: Colors and primitives taken from UPDL Component(Render)

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

### Notes on Component(Render)

- `componentType` is case-insensitive and normalized to lower case (e.g. `Render` or `render`).
- Color can be specified as:
  - hex string: `#00ff00` or `#0f0` or `#aabbccdd` (RGBA),
  - object: `{ r, g, b }` in 0..1 or 0..255,
  - via `props.color` or `props.material.color`.
- When Component(Render) is attached to an Entity, its material has priority and default entity materials are not applied.
- In multiplayer, ship color is also taken from Component(Render) through `networkEntities.visual.color`.

## Architecture

```
src/
├── playcanvas/
│   ├── builders/
│   ├── handlers/
│   ├── generators/
│   └── multiplayer/
├── common/
└── index.ts
```

## Development

### Building

```bash
pnpm build
pnpm build:cjs
pnpm build:esm
pnpm build:types
```
