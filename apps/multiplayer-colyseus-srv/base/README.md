# Universo MMOOMM Multiplayer Server

Colyseus-based multiplayer server for Universo MMOOMM space gameplay.

## Features

- **Real-time multiplayer**: Up to 16 players per room
- **Server-authoritative gameplay**: Mining and trading validated on server
- **Entity synchronization**: Asteroids, stations, and gates synced across clients
- **Simple authentication**: Name-based player identification
- **Position validation**: Prevents cheating with movement bounds

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Server will start on ws://localhost:2567
```

### Production

```bash
# Build TypeScript
pnpm build

# Start production server
pnpm start
```

## Room Configuration

- **Room type**: `mmoomm`
- **Max players**: 16
- **Port**: 2567 (configurable via PORT env var)

## Client Connection

```javascript
const client = new Colyseus.Client('ws://localhost:2567');
const room = await client.joinOrCreate('mmoomm', { 
    name: 'PlayerName' 
});
```

## Message Protocol

### Client → Server

- `updateTransform`: Update player position/rotation
- `startMining`: Request mining action
- `sellAll`: Sell all inventory at nearest station

### Server → Client

- State synchronization via Colyseus schemas
- Real-time updates for players, asteroids, stations

## Architecture

- **MMOOMMRoom**: Main room class handling game logic
- **Schemas**: Type-safe state synchronization
  - `PlayerSchema`: Player position, inventory, credits
  - `EntitySchema`: Asteroids, stations, gates
  - `MMOOMMRoomState`: Complete room state

## Integration

This server integrates with the MMOOMM PlayCanvas template when multiplayer mode is detected (Space with collectLeadName=true + connected Space).

## Environment Variables

- `PORT`: Server port (default: 2567)
- `NODE_ENV`: Environment mode (development/production)

## Testing

Run the Jest suite to verify the process manager lifecycle:

```bash
pnpm --filter @universo/multiplayer-colyseus-srv test
```

The tests mock `child_process.spawn` and filesystem checks to exercise start/stop behaviour without launching a real Colyseus server.
