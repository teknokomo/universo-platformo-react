# @universo/template-mmoomm

> 🎮 MMOOMM template system for generating PlayCanvas applications with single-player and multiplayer support

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/template-mmoomm` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (Game Template) |
| **Build** | Dual build (CommonJS + ESM) |
| **Purpose** | Generate PlayCanvas applications from UPDL data |

See also: Creating New packages/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md

## 🚀 Key Features

- 🎮 **Dual Mode Support**: Single-player and multiplayer (Colyseus) game modes
- 🔄 **UPDL Integration**: Process UPDL flow data into game objects
- 📦 **Modular Architecture**: Separate builders and handlers per mode
- 🎨 **Render Component**: Colors and primitives from UPDL Component(Render)
- ⚡ **TypeScript Support**: Full typing and dual build
- 🎪 **PlayCanvas Integration**: Full-featured PlayCanvas applications

## Installation

```bash
pnpm add @universo/template-mmoomm
```

### Dependencies

This package uses centralized UPDL processing from the Universo Platformo ecosystem:

- `@universo-platformo/utils` - Centralized UPDLProcessor and validation utilities
- `@universo-platformo/types` - Shared UPDL type definitions and interfaces

These dependencies are automatically installed and provide consistent UPDL processing across all template packages.

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

### Testing

```bash
pnpm --filter @universo/template-mmoomm test
```

Automated Vitest checks guard PlayCanvas mode detection, ensuring multiplayer lead collection flows keep working as described above.

## Contributing

When contributing to this package:

1. Follow TypeScript best practices
2. Ensure PlayCanvas template compatibility
3. Add tests for new builders or components
4. Update both EN and RU documentation
5. Follow the project's coding standards

## Related Documentation

- [Main Apps Documentation](../README.md)
- [UPDL Node Definitions](../updl/base/README.md)
- [Publishing Frontend](../publish-frt/base/README.md)
- [Space Builder](../space-builder-frt/base/README.md)
- [PlayCanvas Documentation](https://developer.playcanvas.com/)

---

_Universo Platformo | MMOOMM Template_

