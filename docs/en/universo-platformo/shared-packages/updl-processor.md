# UPDLProcessor

The UPDLProcessor is a core utility class in `@universo-platformo/utils` that converts raw flow data from Flowise into structured UPDL (Universal Platform Definition Language) representations.

## Overview

UPDLProcessor serves as the bridge between Flowise's graph-based flow data and the structured UPDL format used by template builders. It handles both single-space and multi-scene flows, providing a consistent interface for all template systems.

## Architecture

### Processing Pipeline

```
Raw Flow Data (JSON) → UPDLProcessor → UPDL Structure → Template Builders
```

The processor follows this pipeline:

1. **Parse Flow Data**: Convert JSON string to node/edge structure
2. **Analyze Structure**: Detect single-space vs multi-scene patterns
3. **Build UPDL**: Create appropriate UPDL representation
4. **Return Result**: Provide structured data to template builders

### Multi-Scene Detection

The processor automatically detects multi-scene structures by analyzing Space node connections:

- **Single Space**: One Space node or multiple unconnected Spaces
- **Multi-Scene**: Multiple Space nodes connected in a chain

## API Reference

### Main Methods

#### `processFlowData(flowDataString: string)`

Processes raw flow data and returns structured UPDL representation.

**Parameters**:
- `flowDataString`: JSON string containing Flowise flow data

**Returns**:
```typescript
{
  updlSpace?: IUPDLSpace,      // For single-space flows
  multiScene?: IUPDLMultiScene  // For multi-scene flows
}
```

**Example**:
```typescript
import { UPDLProcessor } from '@universo-platformo/utils'

const result = UPDLProcessor.processFlowData(flowDataString)

if (result.multiScene) {
  // Handle multi-scene flow
  console.log(`Found ${result.multiScene.totalScenes} scenes`)
} else if (result.updlSpace) {
  // Handle single space flow
  console.log(`Found ${result.updlSpace.entities.length} entities`)
}
```

### Helper Methods

#### `analyzeSpaceChain(nodes, edges)`

Analyzes Space node connections to build multi-scene structure.

#### `getConnectedNodes(spaceId, nodes, edges)`

Retrieves all nodes connected to a specific Space node.

#### `buildUPDLSpaceFromNodes(nodes, edges)`

Builds a single UPDL space from node/edge data.

## Data Structures

### Single Space Structure

```typescript
interface IUPDLSpace {
  id: string
  name: string
  entities: IUPDLEntity[]
  objects: IUPDLObject[]
  components: IUPDLComponent[]
  events: IUPDLEvent[]
  actions: IUPDLAction[]
  datas: IUPDLData[]
}
```

### Multi-Scene Structure

```typescript
interface IUPDLMultiScene {
  totalScenes: number
  scenes: IUPDLScene[]
}

interface IUPDLScene {
  spaceId: string
  spaceData: IUPDLSpace
  dataNodes: IUPDLData[]
  objectNodes: IUPDLObject[]
  isLast: boolean
  order: number
}
```

## Usage Patterns

### Template Builder Integration

Template builders use UPDLProcessor to convert flow data:

```typescript
class MyTemplateBuilder {
  async buildFromFlowData(flowDataString: string) {
    // Process flow data
    const result = UPDLProcessor.processFlowData(flowDataString)
    
    // Create flow data structure
    const flowData: IFlowData = {
      flowData: flowDataString,
      updlSpace: result.updlSpace,
      multiScene: result.multiScene
    }
    
    // Build template
    return this.build(flowData)
  }
}
```

### Multi-Scene Processing

For multi-scene flows, iterate through scenes:

```typescript
if (result.multiScene) {
  result.multiScene.scenes.forEach((scene, index) => {
    console.log(`Scene ${index}: ${scene.spaceId}`)
    console.log(`Entities: ${scene.spaceData.entities.length}`)
    console.log(`Data nodes: ${scene.dataNodes.length}`)
  })
}
```

## Node Type Processing

### Entity Processing

Entities are converted from Flowise Entity nodes:

```typescript
// Input: Flowise Entity node
{
  id: "Entity_0",
  data: {
    name: "Entity",
    inputs: {
      entityType: "ship",
      transform: { position: { x: 0, y: 2, z: 0 } }
    }
  }
}

// Output: UPDL Entity
{
  id: "Entity_0",
  data: {
    entityType: "ship",
    transform: { position: { x: 0, y: 2, z: 0 } }
  }
}
```

### Component Processing

Components are attached to entities via edge relationships:

```typescript
// Edge: Component_0 → Entity_0
// Result: Component_0 is attached to Entity_0
```

### Data Processing

Data nodes are processed separately and grouped by scene:

```typescript
// Quiz data example
{
  id: "Data_0",
  dataType: "question",
  content: "What is the capital of France?",
  isCorrect: false
}
```

## Edge Relationship Handling

The processor maintains edge relationships between nodes:

### Entity-Component Relationships

```typescript
// Edge: Component → Entity
// Result: Component is attached to Entity
entity.components.push(component)
```

### Event-Action Relationships

```typescript
// Edge: Action → Event
// Result: Action is attached to Event
event.actions.push(action)
```

### Space-Node Relationships

```typescript
// Edge: Node → Space
// Result: Node belongs to Space
space.entities.push(entity)
```

## Error Handling

The processor includes robust error handling:

```typescript
try {
  const result = UPDLProcessor.processFlowData(flowDataString)
  // Process result
} catch (error) {
  console.error('UPDLProcessor error:', error)
  // Handle error appropriately
}
```

## Performance Considerations

### Large Flows

For large flows with many nodes:

- Processing is optimized for O(n) complexity
- Memory usage scales linearly with node count
- Edge processing uses efficient Map structures

### Caching

Consider caching processed results for repeated use:

```typescript
const cache = new Map<string, any>()

function getCachedResult(flowDataString: string) {
  const hash = hashString(flowDataString)
  if (cache.has(hash)) {
    return cache.get(hash)
  }
  
  const result = UPDLProcessor.processFlowData(flowDataString)
  cache.set(hash, result)
  return result
}
```

## Migration Guide

### From Local Implementations

When migrating from local UPDLProcessor implementations:

1. **Update Imports**:
   ```typescript
   // Before
   import { UPDLProcessor } from './common/UPDLProcessor'
   
   // After
   import { UPDLProcessor } from '@universo-platformo/utils'
   ```

2. **Update Types**:
   ```typescript
   // Before
   import { IUPDLSpace } from './types'
   
   // After
   import { IUPDLSpace } from '@universo-platformo/types'
   ```

3. **Remove Local Files**: Delete local UPDLProcessor implementations

### API Compatibility

The centralized UPDLProcessor maintains API compatibility with previous implementations, ensuring smooth migration.

## Best Practices

### Input Validation

Always validate flow data before processing:

```typescript
if (!flowDataString || typeof flowDataString !== 'string') {
  throw new Error('Invalid flow data')
}
```

### Result Checking

Check result structure before use:

```typescript
const result = UPDLProcessor.processFlowData(flowDataString)

if (!result.updlSpace && !result.multiScene) {
  throw new Error('No valid UPDL structure found')
}
```

### Error Recovery

Implement graceful error recovery:

```typescript
try {
  return UPDLProcessor.processFlowData(flowDataString)
} catch (error) {
  console.warn('UPDLProcessor failed, using fallback')
  return createFallbackStructure()
}
```
