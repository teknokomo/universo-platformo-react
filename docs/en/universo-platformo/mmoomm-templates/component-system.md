# Component System

The Component System in MMOOMM templates provides a modular approach to entity functionality. Components can be attached to entities through the Chatflow interface and are processed through a complete data pipeline to ensure proper configuration application.

## Overview

The Component System processes component data through a structured pipeline:

1. **Chatflow Interface** - User configures component properties
2. **UPDLProcessor** - Processes and validates component data
3. **ComponentHandler** - Generates component code
4. **Entity Integration** - Components attach to entities without conflicts

## Component Types

### Trading Component

Enables entity-to-entity trading functionality with configurable interaction ranges.

**Properties:**
- `interactionRange`: Distance for trading interactions (default: 15 units)
- `pricePerTon`: Cost per ton of resources (default: 10 credits)
- `acceptedResources`: Array of accepted resource types

**Example Configuration:**
```json
{
  "componentType": "trading",
  "interactionRange": 1600,
  "pricePerTon": 25,
  "acceptedResources": ["asteroidMass", "platinum", "gold"]
}
```

### Mineable Component

Allows entities to be mined for resources with configurable properties.

**Properties:**
- `resourceType`: Type of resource to yield (default: "asteroidMass")
- `maxYield`: Maximum resource yield (calculated from entity scale)
- `hardness`: Mining difficulty factor (default: 1)
- `asteroidVolume`: Physical volume for density calculations

### Render Component

Controls visual appearance and model rendering.

**Properties:**
- `modelType`: 3D model type ("sphere", "box", "cylinder")
- `material`: Material properties (color, texture, shininess)
- `visible`: Visibility state (default: true)

### Weapon Component

Provides combat and mining capabilities.

**Properties:**
- `weaponType`: Type of weapon ("laser", "projectile")
- `damage`: Damage per hit (default: 1)
- `range`: Maximum effective range
- `cooldownTime`: Time between shots (default: 2000ms)

## Data Flow Pipeline

### 1. Chatflow Configuration

Users configure component properties in the Chatflow interface:

```json
{
  "componentType": "trading",
  "interactionRange": 1600,
  "pricePerTon": 25
}
```

### 2. UPDLProcessor Processing

The UPDLProcessor transmits all ComponentNode fields to the component data structure:

```typescript
// FIXED: Include all ComponentNode fields in component.data
const component = {
  id: node.id,
  data: {
    componentType: inputs.componentType,
    // All component-specific fields are included
    interactionRange: Number(inputs.interactionRange) || 15,
    pricePerTon: Number(inputs.pricePerTon) || 10,
    // ... other fields
  }
}
```

### 3. ComponentHandler Processing

ComponentHandler uses the correct data source for component generation:

```typescript
// FIXED: Use component.data instead of component.data?.properties
const componentData = component.data || {}
const componentType = componentData.componentType

// Generate component code with proper data access
return this.generateComponentCode(componentType, componentData)
```

### 4. Entity Integration

Components are attached to entities before entity type logic to prevent conflicts:

```typescript
// Attached components (executed first to allow UPDL overrides)
${components.map((c: any) => this.componentHandler.attach(c, 'entity')).join('\n')}

// Entity type specific setup (executed after components)
${this.generateEntityTypeLogic(entityType, entityId)}
```

## Component Configuration Examples

### High-Range Trading Station

```json
{
  "entityType": "station",
  "components": [
    {
      "componentType": "trading",
      "interactionRange": 1600,
      "pricePerTon": 15,
      "acceptedResources": ["asteroidMass", "platinum"]
    },
    {
      "componentType": "render",
      "modelType": "box",
      "material": {
        "color": [0.2, 0.8, 0.2],
        "emissive": [0.1, 0.4, 0.1]
      }
    }
  ]
}
```

### Large Mineable Asteroid

```json
{
  "entityType": "asteroid",
  "transform": {
    "scale": [4, 4, 4]
  },
  "components": [
    {
      "componentType": "mineable",
      "resourceType": "platinum",
      "hardness": 3,
      "asteroidVolume": 64
    }
  ]
}
```

### Combat Ship

```json
{
  "entityType": "ship",
  "components": [
    {
      "componentType": "weapon",
      "weaponType": "laser",
      "damage": 2,
      "range": 100,
      "cooldownTime": 1500
    },
    {
      "componentType": "inventory",
      "maxWeight": 1000,
      "maxVolume": 50
    }
  ]
}
```

## Component Priority System

### Execution Order

1. **Component Attachment** - Components are attached first
2. **Entity Type Logic** - Entity type logic executes after components
3. **Override Prevention** - Entity types check for existing component settings

### Override Prevention Example

```typescript
// Station entity type respects Trading Component settings
if (!entity.tradingPost) {
  // Only create default trading post if no Trading Component exists
  entity.tradingPost = {
    interactionRange: 15, // Default value
    // ... other defaults
  }
}
```

## Best Practices

### Component Configuration

1. **Explicit Values**: Always specify component properties explicitly
2. **Reasonable Ranges**: Use appropriate interaction ranges for gameplay balance
3. **Resource Types**: Ensure resource types match available materials
4. **Performance**: Consider performance impact of high interaction ranges

### Data Validation

1. **Type Checking**: Ensure numeric values are properly converted
2. **Default Fallbacks**: Provide sensible defaults for missing properties
3. **Range Limits**: Validate ranges are within reasonable bounds

### Integration Guidelines

1. **Component First**: Configure components before entity type logic
2. **Conflict Avoidance**: Prevent entity types from overriding component settings
3. **Consistent Naming**: Use consistent property names across components

## Troubleshooting

### Common Issues

**Component Properties Not Applied**
- Verify UPDLProcessor transmits all ComponentNode fields
- Check ComponentHandler uses correct data source (`component.data`)
- Ensure entity type logic doesn't override component settings

**Interaction Range Not Working**
- Confirm numeric conversion in UPDLProcessor
- Verify ComponentHandler processes range correctly
- Check entity type respects component configuration

**Component Conflicts**
- Review execution order (components before entity types)
- Implement override prevention in entity type logic
- Use conditional logic to check for existing components

### Debug Information

Enable component debugging:

```typescript
console.log('[Component] Processing:', {
  componentType,
  componentData,
  entityId
});
```

## Technical Implementation

### File Locations

- **UPDLProcessor**: `src/builders/common/UPDLProcessor.ts`
- **ComponentHandler**: `src/builders/templates/mmoomm/playcanvas/handlers/ComponentHandler/index.ts`
- **Component Types**: `src/builders/templates/mmoomm/playcanvas/handlers/ComponentHandler/componentTypes/`

### Key Functions

- `UPDLProcessor.processComponentNodes()` - Component data processing
- `ComponentHandler.attach()` - Component code generation
- `generateComponentCode()` - Type-specific component logic

## Related Systems

- [Entity Transform System](entity-transform-system.md) - Entity positioning and scaling
- [Trading System](trading-system.md) - Trading component implementation
- [Resource System](resource-system.md) - Mineable component integration
