# `packages/updl` — UPDL Frontend — [Status: MVP]

Frontend module with node definitions for creating universal 3D/AR/VR spaces.

## Purpose

Provides a set of specialized node definitions for the Flowise editor, allowing creation of high-level 3D space descriptions.

## Key Features

- **7 Core Nodes**: Space, Entity, Component, Event, Action, Data, Universo
- **Flowise Integration**: Via NodesPool mechanism
- **Technology Support**: AR.js, PlayCanvas and others via publication system
- **Internationalization**: Full i18n support (EN/RU)
- **TypeScript-first**: Complete interface typing
- **Clean Architecture**: Only node definitions, no export logic

## Node Structure

### Core UPDL Node Types

| Node | Purpose | Key Fields |
|------|---------|------------|
| **Space** | Scene/screen containers | id, type (root/module/block), settings |
| **Entity** | Positioned object/actor | transform, tags |
| **Component** | Adds data/behavior to Entity | type, props |
| **Event** | Trigger (OnStart, OnClick, OnTimer) | eventType, source |
| **Action** | Executor (Move, PlaySound, SetData) | actionType, target, params |
| **Data** | Value storage (Local/Space/Global) | key, scope, value |
| **Universo** | Gateway to Kiberplano global network | transports, discovery, security |

### Interaction Chain

Typical scene: **Entity** contains **Component** for visuals/behavior → **Event** triggers **Action** on conditions → Logic defined via `Entity → Component → Event → Action`.

## Usage Examples

### Creating a Simple Scene

```javascript
// Example UPDL structure
{
  "Space": {
    "id": "main-scene",
    "type": "root",
    "entities": [
      {
        "Entity": {
          "id": "player",
          "transform": { "position": [0, 1.6, 0] },
          "components": [
            { "Component": { "type": "camera" } },
            { "Component": { "type": "movement" } }
          ]
        }
      }
    ]
  }
}
```

### Defining Events and Actions

```javascript
{
  "Event": {
    "eventType": "OnClick",
    "source": "button-entity",
    "actions": [
      {
        "Action": {
          "actionType": "PlaySound",
          "target": "audio-entity",
          "params": { "sound": "click.wav" }
        }
      }
    ]
  }
}
```

## Connector Architecture

### Node Connection Rules

1. **Input Connectors**: Defined in parent node's `inputs` array. The `type` value must match child node's `name`.

```typescript
this.inputs = [
    {
        label: 'Entity',
        name: 'entity',
        type: 'UPDLEntity', // Matches child node name
        list: true
    }
];
```

2. **Output Connectors**: For standard output connector, leave `outputs` array empty — Flowise will generate it automatically.

```typescript
this.outputs = []; // Automatic output connector
```

3. **Terminal Nodes**: For nodes without connections (e.g., `ActionNode`), both arrays are empty.

```typescript
this.inputs = [];
this.outputs = [];
```

## Build and Testing

### Build Process

1. **TypeScript Compilation**: `.ts` → `.js`
2. **Gulp Tasks**: Copy static resources (SVG icons) to `dist/`

### Available Commands

```bash
pnpm clean                    # Clean dist/
pnpm build --filter updl      # Full build
pnpm --filter updl dev        # Development mode with watch
pnpm --filter updl lint       # Code linting
pnpm --filter updl test       # Run Vitest tests
```

### Testing

Vitest tests validate:
- Flowise node ports
- Lead-collection flags
- Connector documentation compliance

## Technologies

- **TypeScript**: Full typing
- **Flowise API**: Node definitions
- **i18next**: Internationalization
- **Vitest**: Unit testing
- **Gulp**: Resource copying

## Integration

### Loading into Flowise

UPDL integrates via `NodesPool` mechanism from `dist/nodes` directory:

```javascript
// Flowise automatically loads nodes from:
packages/updl/dist/nodes/
```

### Publication System

Space export logic is handled separately:
- **Space Builders**: `publish-frontend`, `space-builder-frontend`
- **Technology Export**: AR.js, PlayCanvas via publish system
- **API Clients**: Not required for node definitions

## Module Focus

This module is **intentionally focused only on node definitions**:

- ✅ UPDL node definitions
- ✅ TypeScript interfaces
- ✅ i18n translations
- ✅ Static resources (icons)
- ❌ Space building logic
- ❌ Technology export logic
- ❌ API clients
- ❌ State management

This separation ensures optimal architecture and maintainability.

## See Also

- [Publish Frontend](../publish/frontend.md) - Publication system
- [Space Builder](../space-builder/frontend.md) - AI space generation
- [UPDL README](./README.md) - System overview
