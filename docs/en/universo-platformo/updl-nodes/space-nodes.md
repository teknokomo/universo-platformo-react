# Space Nodes

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo React. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

Space Nodes are the foundation of any UPDL experience, defining the virtual environment where all interactions take place.

## Overview

Space Nodes establish the fundamental properties of your 3D/AR/VR environment, including physics, lighting, boundaries, and platform-specific configurations.

## Node Types

### Basic Space Node

The fundamental space definition node that sets up the core environment.

**Inputs:**
- `name` (string) - Unique identifier for the space
- `dimensions` (object) - Width, height, depth of the space
- `physics` (boolean) - Enable/disable physics simulation
- `gravity` (vector3) - Gravity vector for physics

**Outputs:**
- `space` (Space) - Configured space object
- `ready` (boolean) - Space initialization status

**Configuration:**
```json
{
  "name": "MainSpace",
  "dimensions": {
    "width": 100,
    "height": 50,
    "depth": 100
  },
  "physics": true,
  "gravity": { "x": 0, "y": -9.81, "z": 0 }
}
```

### AR Space Node

Specialized space node for augmented reality experiences.

**Inputs:**
- `markerType` (string) - Type of AR marker (pattern, barcode, NFT)
- `markerUrl` (string) - URL to marker pattern file
- `markerSize` (number) - Physical size of marker in meters
- `cameraParameters` (string) - Camera calibration parameters

**Outputs:**
- `arSpace` (ARSpace) - AR-configured space
- `markerDetected` (boolean) - Marker detection status
- `cameraReady` (boolean) - Camera initialization status

**Platform Support:**
- AR.js
- WebXR (where supported)

### VR Space Node

Specialized space node for virtual reality experiences.

**Inputs:**
- `roomScale` (boolean) - Enable room-scale tracking
- `teleportation` (boolean) - Enable teleportation movement
- `handTracking` (boolean) - Enable hand tracking
- `controllers` (array) - Supported controller types

**Outputs:**
- `vrSpace` (VRSpace) - VR-configured space
- `headsetConnected` (boolean) - VR headset status
- `controllersReady` (array) - Controller connection status

**Platform Support:**
- A-Frame
- WebXR
- PlayCanvas VR

### Multiplayer Space Node

Space node configured for multiplayer experiences.

**Inputs:**
- `maxPlayers` (number) - Maximum number of concurrent players
- `serverUrl` (string) - Multiplayer server endpoint
- `roomId` (string) - Unique room identifier
- `syncFrequency` (number) - Update frequency in Hz

**Outputs:**
- `multiplayerSpace` (MultiplayerSpace) - Multiplayer-enabled space
- `connected` (boolean) - Server connection status
- `playerCount` (number) - Current number of players

## Properties

### Environment Properties

**Lighting:**
- `ambientLight` - Global ambient lighting
- `directionalLight` - Sun/directional lighting
- `pointLights` - Array of point light sources
- `spotLights` - Array of spot light sources

**Atmosphere:**
- `skybox` - 360-degree background image/color
- `fog` - Fog settings (color, density, range)
- `weather` - Weather effects (rain, snow, wind)

**Audio:**
- `ambientAudio` - Background audio track
- `spatialAudio` - 3D positional audio settings
- `audioListener` - Audio listener configuration

### Physics Properties

**World Settings:**
- `gravity` - Gravity vector
- `airResistance` - Air resistance coefficient
- `groundFriction` - Ground friction settings
- `collisionDetection` - Collision detection precision

**Boundaries:**
- `bounds` - Space boundaries definition
- `boundaryType` - Boundary behavior (teleport, block, wrap)
- `safeZones` - Areas with special physics rules

## Usage Examples

### Basic 3D Space

```javascript
// Create a basic 3D space for a game
const spaceConfig = {
  name: "GameWorld",
  dimensions: { width: 200, height: 100, depth: 200 },
  physics: true,
  gravity: { x: 0, y: -9.81, z: 0 },
  lighting: {
    ambientLight: { color: "#404040", intensity: 0.4 },
    directionalLight: { 
      color: "#ffffff", 
      intensity: 0.8,
      position: { x: 10, y: 20, z: 10 }
    }
  }
}
```

### AR Marker Space

```javascript
// Create AR space with pattern marker
const arConfig = {
  name: "ARExperience",
  markerType: "pattern",
  markerUrl: "/assets/markers/custom-marker.patt",
  markerSize: 0.1, // 10cm marker
  cameraParameters: "/assets/camera_para.dat"
}
```

### VR Room-Scale Space

```javascript
// Create VR space with room-scale tracking
const vrConfig = {
  name: "VRRoom",
  roomScale: true,
  teleportation: true,
  handTracking: true,
  controllers: ["oculus-touch", "vive-controls"],
  playArea: { width: 3, depth: 3 } // 3x3 meter play area
}
```

## Platform-Specific Considerations

### AR.js Integration
- Marker detection performance varies by lighting
- Camera permissions required
- Mobile device orientation handling
- Marker size affects detection distance

### PlayCanvas Integration
- Asset preloading for better performance
- Lighting baking for mobile optimization
- Physics engine selection (Ammo.js vs Cannon.js)
- Platform-specific input handling

### A-Frame Integration
- Entity-component-system architecture
- WebXR compatibility
- Performance optimization for mobile VR
- Custom component integration

## Best Practices

### Performance Optimization
- Use appropriate physics precision for your use case
- Optimize lighting for target platforms
- Consider LOD (Level of Detail) for large spaces
- Implement frustum culling for better performance

### User Experience
- Provide clear visual boundaries
- Implement smooth transitions between spaces
- Consider accessibility requirements
- Test on target devices early and often

### Development Workflow
- Start with simple space configurations
- Iterate on lighting and atmosphere
- Test physics interactions thoroughly
- Document space-specific behaviors

## Troubleshooting

### Common Issues
- **Physics not working**: Check gravity and physics enabled
- **Poor AR tracking**: Verify marker quality and lighting
- **VR performance issues**: Reduce polygon count and effects
- **Multiplayer sync problems**: Check network connectivity and sync frequency

### Debugging Tools
- Space inspector for real-time property viewing
- Physics visualizer for collision debugging
- Performance profiler for optimization
- Network monitor for multiplayer issues

## Next Steps

- [Entity Nodes](entity-nodes.md) - Add objects to your space
- [Component Nodes](component-nodes.md) - Enhance entities with behaviors
- [MMOOMM Templates](../mmoomm-templates/README.md) - Use pre-built space templates
