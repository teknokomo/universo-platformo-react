# Entity Transform System

The Entity Transform System in MMOOMM templates provides precise control over entity positioning, rotation, and scaling in 3D space. This system ensures that Transform data configured in the Chatflow interface is accurately applied to generated PlayCanvas entities.

## Overview

The Transform system processes entity transformation data through a complete pipeline:

1. **Chatflow Interface** - User configures Transform properties
2. **UPDLProcessor** - Processes and validates Transform data
3. **EntityHandler** - Applies Transform to PlayCanvas entities
4. **Entity Types** - Respect Transform settings without override

## Transform Properties

### Position
- **Type**: Vector3 (x, y, z)
- **Default**: (0, 0, 0)
- **Units**: World units
- **Example**: `{ x: -10, y: 0, z: 5 }`

### Rotation
- **Type**: Vector3 (x, y, z)
- **Default**: (0, 0, 0)
- **Units**: Degrees (Euler angles)
- **Example**: `{ x: 0, y: 45, z: 0 }`

### Scale
- **Type**: Vector3 (x, y, z)
- **Default**: (1, 1, 1)
- **Units**: Multiplier
- **Example**: `{ x: 4, y: 4, z: 4 }`

## Data Flow Pipeline

### 1. Chatflow Configuration

Users configure Transform properties in the Chatflow interface:

```json
{
  "transform": {
    "pos": [-10, 0, 5],
    "rot": [0, 0, 0],
    "scale": [4, 4, 4]
  }
}
```

### 2. UPDLProcessor Processing

The UPDLProcessor converts array format to object format:

```typescript
// Input: [4, 4, 4]
// Output: { x: 4, y: 4, z: 4 }
transform.scale = Array.isArray(sc)
  ? { x: Number(sc[0]) || 1, y: Number(sc[1]) || 1, z: Number(sc[2]) || 1 }
  : sc
```

### 3. EntityHandler Application

EntityHandler applies Transform data to PlayCanvas entities:

```typescript
const transform = entity.data?.transform || {}
const position = transform.position || { x: 0, y: 0, z: 0 }
const rotation = transform.rotation || { x: 0, y: 0, z: 0 }
const scale = transform.scale || { x: 1, y: 1, z: 1 }

entity.setLocalPosition(position.x, position.y, position.z);
entity.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
entity.setLocalScale(scale.x, scale.y, scale.z);
```

### 4. Entity Type Respect

Entity types respect Transform settings without override:

```typescript
// Asteroid entity type respects user-defined scale
// No random scale generation when Transform is specified
const entityScale = entity.getLocalScale();
const scaleMultiplier = Math.max(entityScale.x, entityScale.y, entityScale.z);
```

## Configuration Examples

### Basic Entity Positioning

```json
{
  "entityType": "ship",
  "transform": {
    "pos": [0, 2, 0],
    "rot": [0, 0, 0],
    "scale": [1, 1, 1]
  }
}
```

### Large Asteroid Configuration

```json
{
  "entityType": "asteroid",
  "transform": {
    "pos": [-10, 0, 5],
    "rot": [0, 0, 0],
    "scale": [4, 4, 4]
  }
}
```

### Trading Station Placement

```json
{
  "entityType": "station",
  "transform": {
    "pos": [20, 0, 0],
    "rot": [0, 45, 0],
    "scale": [2, 2, 2]
  }
}
```

## Best Practices

### Scale Considerations

1. **Explicit Values**: Always specify exact scale values for predictable results
2. **Proportional Scaling**: Use uniform scaling (e.g., 4,4,4) for consistent proportions
3. **Resource Yield**: Larger asteroids (higher scale) yield more resources automatically

### Position Guidelines

1. **World Coordinates**: Use world coordinate system for positioning
2. **Collision Avoidance**: Ensure adequate spacing between entities
3. **Gameplay Balance**: Consider interaction ranges when positioning entities

### Rotation Best Practices

1. **Euler Angles**: Use degrees for intuitive rotation specification
2. **Gimbal Lock**: Be aware of potential gimbal lock at 90-degree rotations
3. **Visual Orientation**: Consider visual orientation for gameplay elements

## Troubleshooting

### Common Issues

**Scale Not Applied**
- Verify Transform data is properly formatted in Chatflow
- Check that entity type doesn't override scale values
- Ensure UPDLProcessor transmits scale data correctly

**Position Offset**
- Confirm coordinate system understanding (Y-up in PlayCanvas)
- Check for entity type positioning logic conflicts
- Verify Transform data parsing in UPDLProcessor

**Rotation Problems**
- Use Euler angles in degrees, not radians
- Consider rotation order (XYZ) for complex rotations
- Test with simple single-axis rotations first

### Debug Information

Enable debug logging to trace Transform data flow:

```typescript
console.log('[DEBUG] Entity transform data:', {
  entityId,
  transform,
  position,
  rotation,
  scale
});
```

## Technical Implementation

### File Locations

- **UPDLProcessor**: `src/builders/common/UPDLProcessor.ts`
- **EntityHandler**: `src/builders/templates/mmoomm/playcanvas/handlers/EntityHandler/index.ts`
- **Entity Types**: `src/builders/templates/mmoomm/playcanvas/handlers/EntityHandler/entityTypes/`

### Key Functions

- `UPDLProcessor.processEntityNodes()` - Transform data processing
- `EntityHandler.attach()` - Transform application
- `generateEntityTypeLogic()` - Entity-specific Transform handling

## Related Systems

- [Component System](component-system.md) - Component-based entity configuration
- [Trading System](trading-system.md) - Trading component interaction ranges
- [Resource System](resource-system.md) - Scale-based resource yield calculation
