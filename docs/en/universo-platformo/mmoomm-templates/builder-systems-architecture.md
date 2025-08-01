# Builder Systems Architecture

The Builder Systems Architecture provides a modular approach to code generation in MMOOMM templates. This system was refactored from a monolithic 1,211-line file into a clean, maintainable architecture with 79% code reduction while preserving all functionality.

## Overview

The Builder Systems Architecture consists of several specialized modules:

- **Core Systems** - Central coordination and scene generation
- **Embedded Systems** - JavaScript systems embedded in HTML
- **HTML Systems** - HTML document generation and registry
- **Initialization Systems** - PlayCanvas and scene initialization
- **Global Objects** - Window object lifecycle management

## Architecture Components

### Core Systems

Located in `builderSystems/core/`

#### BuilderSystemsManager
Central coordinator for all builder systems.

**Responsibilities:**
- Coordinate all subsystems
- Generate complete HTML documents
- Manage embedded JavaScript integration
- Provide unified API for template builders

**Key Methods:**
```typescript
generateCompleteHTML(entities, components, events): string
generateEmbeddedJavaScript(): string
initializeAllSystems(): void
```

#### DefaultSceneGenerator
Generates default scene configurations and error handling.

**Features:**
- Default lighting setup
- Camera configuration
- Error scene generation
- Scene validation

### Embedded Systems

Located in `builderSystems/systems/`

#### embeddedControlsSystem
Manages space ship control systems embedded in HTML.

**Features:**
- WASD movement controls
- Camera rotation (Q/Z, E/C)
- Laser mining controls (Space)
- Trading interactions (F)

#### embeddedHUDSystem
Provides heads-up display functionality.

**Features:**
- Real-time inventory display
- Ship status information
- Resource counters
- Trading interface

#### embeddedPhysicsSystem
Handles physics initialization and management.

**Features:**
- Zero-gravity space physics
- Collision detection setup
- Rigidbody management
- Physics world configuration

#### embeddedHelperFunctions
Utility functions for game mechanics.

**Features:**
- Trading helper functions (`tradeAll`, `tradeHalf`)
- Space controls initialization
- Entity management utilities

### HTML Systems

Located in `builderSystems/htmlSystems/`

#### htmlDocumentGenerator
Generates complete HTML documents with embedded JavaScript.

**Features:**
- HTML structure generation
- CSS styling integration
- JavaScript embedding
- PlayCanvas library integration

#### embeddedSystemsRegistry
Registry for all embedded JavaScript systems.

**Features:**
- System registration and lookup
- Dependency management
- Execution order control
- Global object coordination

### Initialization Systems

Located in `builderSystems/initialization/`

#### playcanvasInitializer
Handles PlayCanvas engine initialization.

**Features:**
- Canvas setup and configuration
- Engine initialization
- Graphics settings
- Performance optimization

#### sceneInitializer
Manages scene setup and entity creation.

**Features:**
- Scene hierarchy creation
- Entity instantiation
- Component attachment
- Event system setup

### Global Objects Management

Located in `builderSystems/globalObjects/`

#### globalObjectsManager
Manages window object lifecycle and global state.

**Features:**
- Window object registration
- Global state management
- Cross-system communication
- Memory cleanup

## File Naming Convention

All files follow consistent camelCase naming:

```
builderSystems/
├── core/
│   ├── builderSystemsManager.ts
│   ├── defaultSceneGenerator.ts
│   └── index.ts
├── systems/
│   ├── embeddedControlsSystem.ts
│   ├── embeddedHUDSystem.ts
│   ├── embeddedPhysicsSystem.ts
│   ├── embeddedHelperFunctions.ts
│   └── index.ts
├── htmlSystems/
│   ├── htmlDocumentGenerator.ts
│   ├── embeddedSystemsRegistry.ts
│   └── index.ts
├── initialization/
│   ├── playcanvasInitializer.ts
│   ├── sceneInitializer.ts
│   └── index.ts
└── globalObjects/
    ├── globalObjectsManager.ts
    └── index.ts
```

## Integration Flow

### 1. System Initialization

```typescript
// BuilderSystemsManager coordinates all systems
const manager = new BuilderSystemsManager();
manager.initializeAllSystems();
```

### 2. HTML Generation

```typescript
// Generate complete HTML with embedded systems
const html = manager.generateCompleteHTML(entities, components, events);
```

### 3. JavaScript Embedding

```typescript
// Embed all JavaScript systems
const embeddedJS = manager.generateEmbeddedJavaScript();
```

### 4. PlayCanvas Integration

```typescript
// Initialize PlayCanvas with generated content
const playcanvasCode = playcanvasInitializer.generateInitCode();
const sceneCode = sceneInitializer.generateSceneCode();
```

## Template Integration

### PlayCanvasMMOOMMBuilder Integration

```typescript
export class PlayCanvasMMOOMMBuilder extends AbstractTemplateBuilder {
  private builderSystemsManager: BuilderSystemsManager;

  constructor() {
    super();
    this.builderSystemsManager = new BuilderSystemsManager();
  }

  build(data: any): string {
    // Extract and process nodes
    const { entities, components, events } = this.extractNodes(data);
    
    // Generate complete HTML using modular systems
    return this.builderSystemsManager.generateCompleteHTML(
      entities, 
      components, 
      events
    );
  }
}
```

## Benefits of Modular Architecture

### Maintainability
- **Separation of Concerns**: Each system has a specific responsibility
- **Code Organization**: Logical grouping of related functionality
- **Easy Updates**: Changes isolated to specific modules

### Reusability
- **Shared Templates**: Systems can be reused across different templates
- **Component Libraries**: Embedded systems work as reusable components
- **Template Inheritance**: New templates can extend existing systems

### Testability
- **Unit Testing**: Individual systems can be tested in isolation
- **Integration Testing**: System interactions can be validated
- **Debugging**: Issues can be traced to specific modules

### Performance
- **Code Splitting**: Only necessary systems are loaded
- **Lazy Loading**: Systems can be loaded on demand
- **Optimization**: Individual systems can be optimized independently

## Best Practices

### Module Design
1. **Single Responsibility**: Each module should have one clear purpose
2. **Loose Coupling**: Minimize dependencies between modules
3. **High Cohesion**: Related functionality should be grouped together

### File Organization
1. **Consistent Naming**: Use camelCase for all file names
2. **Logical Grouping**: Group related files in appropriate directories
3. **Clear Exports**: Use index.ts files for clean module exports

### Code Quality
1. **TypeScript Interfaces**: Define clear interfaces for system contracts
2. **Error Handling**: Implement proper error handling in each system
3. **Documentation**: Document system responsibilities and APIs

## Migration Guide

### From Monolithic to Modular

1. **Identify Systems**: Break down monolithic code into logical systems
2. **Extract Interfaces**: Define clear interfaces for each system
3. **Create Modules**: Implement each system as a separate module
4. **Update Imports**: Update all import statements to use new modules
5. **Test Integration**: Verify all systems work together correctly

### Updating Existing Code

1. **Import Changes**: Update imports to use new module structure
2. **API Changes**: Adapt to new system APIs if necessary
3. **Configuration**: Update configuration to use new system structure

## Related Documentation

- [Entity Transform System](entity-transform-system.md) - Entity positioning and scaling
- [Component System](component-system.md) - Component-based entity configuration
- [MMOOMM Templates Overview](README.md) - General template documentation
