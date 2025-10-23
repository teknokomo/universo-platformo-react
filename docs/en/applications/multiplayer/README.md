# Multiplayer System

> **📋 Status**: ✅ **IMPLEMENTED** - Complete Colyseus-based multiplayer server for Universo MMOOMM

A comprehensive real-time multiplayer system for Universo MMOOMM space gameplay, providing server-authoritative gameplay mechanics, entity synchronization, and seamless UPDL integration.

## Overview

The multiplayer system enables real-time collaborative space gameplay in Universo MMOOMM, allowing up to 16 players to interact in the same space environment. Built on Colyseus framework with TypeScript, it provides robust state synchronization, anti-cheat measures, and seamless integration with UPDL Flow objects.

## Features

### Core Multiplayer Capabilities

- **Real-time Multiplayer**: Up to 16 players per room with WebSocket-based communication
- **Server-Authoritative Gameplay**: Mining, trading, and movement validation on server
- **Entity Synchronization**: Asteroids, stations, and gates synced across all clients
- **UPDL Integration**: Support for UPDL Flow objects in multiplayer mode
- **Type-Safe State Management**: Colyseus schemas ensure reliable synchronization

### Game Mechanics

- **Mining System**: Server-validated resource extraction with inventory management
- **Trading System**: Station-based trading with credit management
- **Movement Validation**: Position bounds checking to prevent cheating
- **Player Management**: Name-based authentication with session handling

### Technical Features

- **Production Ready**: Complete TypeScript implementation with error handling
- **Graceful Shutdown**: Proper process lifecycle management
- **Environment Configuration**: Flexible deployment configuration
- **Integration Layer**: Seamless integration with main Flowise server

## Architecture

### Package Structure

```
packages/multiplayer-colyseus-srv/base/
├── package.json          # Dependencies: colyseus, @colyseus/schema
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── index.ts          # Server entry point
│   ├── manager.ts        # Room manager
│   ├── rooms/
│   │   └── MMOOMMRoom.ts # Main room implementation (377 lines)
│   ├── schemas/
│   │   ├── index.ts      # Schema exports
│   │   ├── PlayerSchema.ts
│   │   ├── EntitySchema.ts
│   │   └── MMOOMMRoomState.ts
│   ├── integration/
│   │   └── MultiplayerManager.ts # Integration layer (165 lines)
│   └── utils/
│       └── logger.ts     # Logging utilities
└── README.md             # Documentation
```

### Core Components

#### MMOOMMRoom Class
- **16-player capacity** room management
- **Real-time state synchronization** via Colyseus schemas
- **Server-authoritative gameplay** validation
- **UPDL entity processing** and management

#### Schema System
- **PlayerSchema**: Player state, position, inventory, credits
- **EntitySchema**: Asteroids, stations, gates with game-specific properties
- **MMOOMMRoomState**: Complete room state management

#### Integration Layer
- **MultiplayerManager**: Seamless integration with main Flowise server
- **Process lifecycle management** with proper startup/shutdown
- **Environment configuration** handling

## Quick Start

### Development Setup

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev

# Server will start on ws://localhost:2567
```

### Production Deployment

```bash
# Build TypeScript
pnpm build

# Start production server
pnpm start
```

### Environment Configuration

```bash
# Server port (default: 2567)
PORT=2567

# Environment mode
NODE_ENV=production

# Enable multiplayer server
ENABLE_MULTIPLAYER_SERVER=true

# Multiplayer server host
MULTIPLAYER_SERVER_HOST=localhost
```

## Client Integration

### Connection Setup

```javascript
const client = new Colyseus.Client('ws://localhost:2567');
const room = await client.joinOrCreate('mmoomm', { 
    name: 'PlayerName' 
});
```

### Message Protocol

#### Client → Server Messages
- `updateTransform`: Update player position/rotation
- `startMining`: Request mining action on target entity
- `sellAll`: Sell all inventory at nearest station

#### Server → Client Updates
- **State synchronization** via Colyseus schemas
- **Real-time updates** for players, asteroids, stations
- **Game events** (mining completion, trading, etc.)

## UPDL Integration

### Multiplayer Mode Detection
The system automatically detects multiplayer mode when:
- Space node has `collectLeadName=true`
- Connected Space nodes are present in the UPDL flow

### Entity Processing
- **UPDL Flow objects** are extracted and synchronized
- **Multi-scene support** for complex UPDL flows
- **Fallback entities** when UPDL data is incomplete
- **Material properties** and component data synchronization

### Entity Types Supported
- **Asteroids**: Mining targets with resource properties
- **Stations**: Trading locations with buy/sell prices
- **Gates**: Teleportation points with target world data
- **Ships**: Player vehicles with movement and combat capabilities

## Game Mechanics

### Mining System
- **Server validation** of mining actions
- **Resource collection** with inventory management
- **Material properties** from UPDL components
- **Cooldown management** to prevent exploitation

### Trading System
- **Station-based trading** with credit management
- **Price validation** and transaction processing
- **Inventory management** with capacity limits
- **Transaction logging** for audit purposes

### Movement System
- **Position validation** with bounds checking
- **Anti-cheat measures** for movement speed
- **Smooth interpolation** for other players
- **Collision detection** with game objects

## Security Features

### Anti-Cheat Measures
- **Server-authoritative validation** of all game actions
- **Movement bounds checking** to prevent teleportation
- **Rate limiting** on client actions
- **Transaction validation** for trading operations

### Authentication
- **Name-based identification** for simple multiplayer
- **Session management** with proper cleanup
- **Connection validation** and error handling
- **Graceful disconnection** handling

## Performance Optimization

### State Synchronization
- **Efficient schema design** reduces network traffic
- **Selective updates** minimize bandwidth usage
- **Room-based isolation** supports horizontal scaling
- **Memory management** with proper cleanup

### Scalability
- **Redis presence support** for horizontal scaling
- **Room isolation** enables multiple server instances
- **Resource management** supports higher player counts
- **Process lifecycle** management for stability

## Integration with Main Platform

### MultiplayerManager Integration
The `MultiplayerManager` class provides seamless integration with the main Flowise server:

```typescript
// Automatic startup when enabled
ENABLE_MULTIPLAYER_SERVER=true

// Process lifecycle management
await multiplayerManager.start();
await multiplayerManager.stop();

// Environment configuration
MULTIPLAYER_SERVER_PORT=2567
MULTIPLAYER_SERVER_HOST=localhost
```

### UPDL Template Integration
- **Automatic detection** of multiplayer mode in UPDL flows
- **Entity extraction** from UPDL components
- **Template generation** with multiplayer client code
- **Backward compatibility** with single-player mode

## Development Guidelines

### Adding New Game Mechanics
1. **Define schema changes** in appropriate schema files
2. **Implement server logic** in MMOOMMRoom class
3. **Add client message handlers** for new actions
4. **Update documentation** and examples

### Testing Multiplayer Features
1. **Local testing** with multiple browser tabs
2. **Functionality validation** of all game mechanics
3. **Performance testing** with maximum player count
4. **Integration testing** with UPDL flows

### Error Handling
- **Comprehensive logging** for debugging
- **Graceful error recovery** for network issues
- **Client reconnection** handling
- **State consistency** validation

## Future Enhancements

### Planned Improvements
- **Redis Presence**: Horizontal scaling with Redis
- **Advanced Game Mechanics**: More complex multiplayer interactions
- **Performance Monitoring**: Metrics and monitoring for production
- **Security Enhancements**: Additional anti-cheat measures

### Potential Extensions
- **Cross-Room Communication**: Player interaction across rooms
- **Persistent World**: State persistence across server restarts
- **Advanced UPDL Features**: Support for complex UPDL node types
- **Mobile Support**: Optimization for mobile multiplayer

## Troubleshooting

### Common Issues

#### Connection Problems
- Verify server is running on correct port
- Check firewall settings for WebSocket connections
- Validate environment configuration

#### UPDL Integration Issues
- Ensure UPDL flow has proper Space node configuration
- Check entity data extraction in server logs
- Verify multiplayer mode detection logic

#### Performance Issues
- Monitor server resource usage
- Check network bandwidth for large rooms
- Validate schema efficiency for state updates

### Debug Mode
Enable debug logging for detailed troubleshooting:

```typescript
// In MMOOMMRoom.ts
private static DEBUG_ENTITIES = true;
```

## Related Documentation

- [UPDL System](../updl/README.md) - Universal Platform Definition Language
- [Publication System](../publish/README.md) - Content publishing and sharing
- [MMOOMM Template](../publish/README.md#mmoomm-template) - Space MMO template
- [Colyseus Documentation](https://docs.colyseus.io/) - Official Colyseus docs

## Support

For issues and questions:
- Check server logs for error details
- Verify UPDL flow configuration
- Test with minimal multiplayer setup
- Review integration documentation
