# Current Active Context

## Complex UPDL Structures Development

### Current Goal 🎯

Enable creation of complex UPDL structures in Chatflow that support:

-   Multiple 3D objects within single Space node
-   Multiple interconnected Space nodes in single Chatflow
-   Advanced AR.js publication/export functionality for complex scenes

### Architecture Foundation ✅

**Completed Infrastructure:**

-   **Project Structure**: Clean separation between UPDL node definitions (`apps/updl/`) and publication system (`apps/publish-frt/`, `apps/publish-srv/`)
-   **AR.js Publication**: Working streaming generation with Supabase persistence
-   **UPDL Integration**: Nodes loaded by Flowise NodesPool, processed by utilBuildUPDLflow
-   **API Routes**: Correct authentication with `/api/v1/uniks/{unikId}/chatflows/{chatflowId}`

### Current Development Focus

#### Multi-Object Spaces

**Objective**: Support multiple 3D objects in single Space node

**Current State**: Basic single-object spaces working
**Target State**: Rich scenes with multiple positioned objects

**Key Areas**:

-   Object positioning and relationship management
-   Dynamic object generation from UPDL data
-   Proper coordinate system handling

#### Connected Spaces Architecture

**Objective**: Multiple Space nodes in single Chatflow with navigation

**Current State**: Single space per chatflow
**Target State**: Multi-space experiences with transitions

**Key Areas**:

-   Space relationship and navigation logic
-   Cross-space object references
-   User experience for space transitions

#### Advanced AR.js Generation

**Objective**: Complex scene generation from multi-space UPDL

**Current State**: Simple space-to-AR.js conversion
**Target State**: Rich AR experiences with interactions

**Key Areas**:

-   Complex scene generation algorithms
-   Space transitions and interactions
-   Enhanced object behavior and properties

### UPDL Node Enhancement Strategy

#### Enhanced Space Node Capabilities

-   **Multi-object support**: Array of objects instead of single object
-   **Spatial relationships**: Positioning, grouping, hierarchies
-   **Scene properties**: Lighting, environment, background

#### Advanced Object Nodes

-   **Interaction capabilities**: Touch, proximity, animation triggers
-   **Advanced properties**: Physics, materials, textures
-   **Behavioral logic**: State management, conditional appearance

#### Navigation and Linking Nodes

-   **Portal nodes**: Transitions between spaces
-   **Trigger nodes**: Conditional navigation logic
-   **State nodes**: Persistent data across spaces

### Implementation Priorities

#### Phase 1: Multi-Object Foundation

1. **Space Node Enhancement**

    - Modify Space node to accept multiple objects
    - Implement object array handling in utilBuildUPDLflow
    - Update UPDLToARJSConverter for multi-object scenes

2. **Object Positioning System**
    - Relative positioning within space
    - Collision detection and automatic layout
    - Visual positioning tools in Flowise interface

#### Phase 2: Multi-Space Architecture

1. **Chatflow Multi-Space Support**

    - Multiple Space nodes in single Chatflow
    - Space identification and referencing system
    - Navigation logic between spaces

2. **AR.js Multi-Scene Generation**
    - Scene switching mechanisms
    - State preservation across scenes
    - User navigation interfaces

#### Phase 3: Advanced Features

1. **Interactive Objects**

    - Object interaction definitions
    - Event handling in AR.js output
    - Complex object behaviors

2. **Advanced Navigation**
    - Conditional navigation logic
    - User choice-driven experiences
    - Progress tracking and state management

### Technical Considerations

#### Performance Optimization

-   Asset preloading for multi-object scenes
-   Progressive loading for large spaces
-   Mobile device optimization

#### User Experience

-   Intuitive Chatflow interface for complex structures
-   Visual feedback for space relationships
-   Clear error handling for complex configurations

#### Architecture Scalability

-   Plugin system for new object types
-   Extensible navigation mechanisms
-   Future support for other 3D platforms

### Success Metrics

#### Functionality Goals

-   [ ] Single Space with 5+ objects positioned correctly
-   [ ] Chatflow with 3+ connected Spaces
-   [ ] Seamless navigation between Spaces in AR.js
-   [ ] Complex object interactions working

#### User Experience Goals

-   [ ] Intuitive Chatflow interface for multi-object scenes
-   [ ] Clear visual representation of Space relationships
-   [ ] Smooth AR.js experiences on mobile devices
-   [ ] Comprehensive error handling and validation

### Current Status

**Phase**: Planning and Foundation
**Next Steps**:

1. Analyze current Space and Object node implementations
2. Design multi-object Space node architecture
3. Implement enhanced UPDL processing in utilBuildUPDLflow
4. Begin UPDLToARJSConverter enhancements for complex scenes

This represents a significant evolution from basic AR.js publication to sophisticated 3D experience creation platform.
