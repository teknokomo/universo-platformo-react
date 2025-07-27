# Entity Nodes

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo React. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

Entity Nodes create interactive objects, characters, and elements within your UPDL spaces.

## Overview

Entity Nodes represent any object that exists within your 3D/AR/VR environment. They can be static objects, interactive items, characters, or complex systems with multiple components.

## Node Types

### Basic Entity Node

The fundamental entity creation node for general-purpose objects.

**Inputs:**
- `name` (string) - Unique identifier for the entity
- `model` (string) - Path to 3D model file
- `position` (vector3) - Initial position in space
- `rotation` (vector3) - Initial rotation (Euler angles)
- `scale` (vector3) - Scale factor for each axis

**Outputs:**
- `entity` (Entity) - Created entity object
- `loaded` (boolean) - Model loading status
- `bounds` (BoundingBox) - Entity bounding box

**Supported Formats:**
- GLTF/GLB (recommended)
- OBJ + MTL
- FBX (platform dependent)
- Collada (DAE)

### Character Entity Node

Specialized entity for animated characters and NPCs.

**Inputs:**
- `characterModel` (string) - Character 3D model with skeleton
- `animations` (array) - Animation clip definitions
- `defaultAnimation` (string) - Initial animation to play
- `aiController` (AIController) - AI behavior controller

**Outputs:**
- `character` (CharacterEntity) - Character entity with animation
- `animator` (Animator) - Animation controller
- `aiState` (string) - Current AI state

**Animation Support:**
- Skeletal animations
- Morph target animations
- Procedural animations
- Animation blending

### Interactive Entity Node

Entity with built-in interaction capabilities.

**Inputs:**
- `interactionType` (string) - Type of interaction (click, hover, proximity)
- `interactionRange` (number) - Interaction distance
- `highlightOnHover` (boolean) - Visual feedback on hover
- `soundEffects` (object) - Audio feedback configuration

**Outputs:**
- `interactiveEntity` (InteractiveEntity) - Entity with interaction
- `interactionState` (string) - Current interaction state
- `lastInteraction` (timestamp) - Last interaction time

### Resource Entity Node

Entity representing collectible or tradeable resources.

**Inputs:**
- `resourceType` (string) - Type of resource (ore, energy, data)
- `quantity` (number) - Amount of resource
- `rarity` (string) - Resource rarity level
- `extractionTime` (number) - Time required to collect

**Outputs:**
- `resourceEntity` (ResourceEntity) - Resource entity
- `harvestable` (boolean) - Can be collected
- `value` (number) - Current market value

### Vehicle Entity Node

Entity for vehicles and transportation systems.

**Inputs:**
- `vehicleType` (string) - Type of vehicle (ship, car, aircraft)
- `maxSpeed` (number) - Maximum velocity
- `acceleration` (number) - Acceleration rate
- `controlScheme` (string) - Input control mapping

**Outputs:**
- `vehicle` (VehicleEntity) - Vehicle entity
- `pilot` (Entity) - Current pilot/driver
- `velocity` (vector3) - Current velocity vector

## Entity Properties

### Transform Properties
- `position` - World position coordinates
- `rotation` - Rotation in 3D space
- `scale` - Size scaling factors
- `parent` - Parent entity for hierarchical transforms

### Visual Properties
- `material` - Surface material and textures
- `color` - Base color tint
- `opacity` - Transparency level
- `visibility` - Show/hide state
- `castShadows` - Shadow casting enabled
- `receiveShadows` - Shadow receiving enabled

### Physics Properties
- `mass` - Physical mass for physics simulation
- `friction` - Surface friction coefficient
- `restitution` - Bounciness factor
- `collisionShape` - Collision detection shape
- `kinematic` - Physics body type

### Metadata Properties
- `tags` - Classification tags
- `userData` - Custom data storage
- `description` - Human-readable description
- `category` - Entity category

## Usage Examples

### Basic 3D Object

```javascript
// Create a simple 3D object
const basicEntity = {
  name: "Crate",
  model: "/assets/models/wooden_crate.glb",
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  physics: {
    mass: 10,
    collisionShape: "box"
  }
}
```

### Animated Character

```javascript
// Create an animated NPC character
const npcCharacter = {
  name: "SpaceTrader",
  characterModel: "/assets/characters/trader.glb",
  animations: [
    { name: "idle", file: "idle.glb" },
    { name: "walk", file: "walk.glb" },
    { name: "talk", file: "talk.glb" }
  ],
  defaultAnimation: "idle",
  aiController: {
    type: "merchant",
    dialogues: "/assets/dialogues/trader.json"
  }
}
```

### Interactive Resource

```javascript
// Create a mineable asteroid
const asteroid = {
  name: "IronAsteroid",
  model: "/assets/asteroids/iron_asteroid.glb",
  resourceType: "iron_ore",
  quantity: 100,
  rarity: "common",
  extractionTime: 3000, // 3 seconds
  interactionType: "proximity",
  interactionRange: 5
}
```

### Player Ship

```javascript
// Create a player-controlled spaceship
const playerShip = {
  name: "PlayerShip",
  vehicleType: "spaceship",
  model: "/assets/ships/fighter.glb",
  maxSpeed: 50,
  acceleration: 10,
  controlScheme: "wasd_qz",
  weapons: [
    { type: "laser", damage: 25, range: 100 }
  ]
}
```

## Entity Lifecycle

### Creation Phase
1. **Model Loading** - Load 3D model and textures
2. **Component Attachment** - Add behavior components
3. **Physics Setup** - Initialize physics body
4. **Event Registration** - Register for relevant events

### Runtime Phase
1. **Update Loop** - Process frame updates
2. **Interaction Handling** - Respond to user interactions
3. **State Management** - Update entity state
4. **Rendering** - Draw entity to screen

### Destruction Phase
1. **Cleanup Components** - Remove attached components
2. **Physics Removal** - Remove from physics world
3. **Event Unregistration** - Clean up event listeners
4. **Memory Cleanup** - Free allocated resources

## Platform-Specific Features

### AR.js Entities
- Marker-relative positioning
- Occlusion handling
- Mobile performance optimization
- Touch interaction support

### PlayCanvas Entities
- Entity-component architecture
- Asset streaming
- LOD (Level of Detail) support
- Batch rendering optimization

### A-Frame Entities
- HTML-like entity declaration
- Component composition system
- WebXR integration
- Custom component development

## Best Practices

### Performance Optimization
- Use appropriate LOD models
- Implement object pooling for frequently created entities
- Optimize texture sizes for target platforms
- Use instancing for repeated objects

### User Experience
- Provide clear visual feedback for interactions
- Implement smooth animations and transitions
- Consider accessibility requirements
- Test on various devices and platforms

### Development Workflow
- Start with simple placeholder models
- Implement core functionality before visual polish
- Use version control for 3D assets
- Document entity behaviors and interactions

## Advanced Features

### Entity Hierarchies
Create parent-child relationships between entities for complex objects:

```javascript
const spaceship = {
  name: "Mothership",
  children: [
    { name: "Engine", position: { x: 0, y: 0, z: -5 } },
    { name: "Cockpit", position: { x: 0, y: 2, z: 3 } },
    { name: "Cargo", position: { x: 0, y: -1, z: 0 } }
  ]
}
```

### Dynamic Entity Creation
Create entities at runtime based on game state:

```javascript
// Spawn entities based on player actions
function spawnAsteroid(position) {
  return createEntity({
    name: `Asteroid_${Date.now()}`,
    model: getRandomAsteroidModel(),
    position: position,
    resourceType: getRandomResource()
  });
}
```

### Entity Pooling
Reuse entities for better performance:

```javascript
const bulletPool = new EntityPool({
  template: bulletEntityTemplate,
  initialSize: 50,
  maxSize: 200
});
```

## Troubleshooting

### Common Issues
- **Model not loading**: Check file path and format support
- **Animation not playing**: Verify animation clips and controller setup
- **Physics not working**: Check collision shapes and physics properties
- **Performance issues**: Optimize model complexity and texture sizes

### Debugging Tools
- Entity inspector for real-time property viewing
- Model viewer for asset validation
- Performance profiler for optimization
- Animation debugger for character issues

## Next Steps

- [Component Nodes](component-nodes.md) - Add behaviors to your entities
- [Action Nodes](action-nodes.md) - Define entity interactions
- [MMOOMM Templates](../mmoomm-templates/README.md) - Use pre-built entity templates
