# Global Dependencies Map

## Overview
**Critical**: All global objects and event listeners used in PlayCanvasMMOOMMBuilder.ts
**Purpose**: Ensure preservation during refactoring

## Window Global Objects

### 1. window.app (PlayCanvas Application)
**Created**: Line 331 in `generatePlayCanvasInit()`
**Type**: `pc.Application`
**Usage**:
- Physics system access: `app.systems.rigidbody`
- Event handling: `app.on('start')`, `app.on('update')`
- Scene management: `app.root.children`
- Canvas operations: `app.resizeCanvas()`

**Dependencies**:
- Used by: SpaceControls.init(), initializePhysics(), initializeSpaceControls()
- Critical for: Physics initialization, update loops, event handling

### 2. window.spaceCamera (Main Camera)
**Created**: Line 325 in `generatePlayCanvasInit()`
**Type**: `pc.Entity`
**Usage**:
- Camera positioning and rotation
- Ship following behavior
- Zoom operations

**Dependencies**:
- Used by: SpaceControls.updateCamera(), SpaceControls.basicCameraFollow()
- Ship integration: entity.cameraController.target = entity

### 3. window.SpaceHUD (HUD System)
**Created**: Line 553 in embedded JavaScript
**Type**: Object with methods
**Methods**:
- `updateShipStatus(ship)`
- `showTradingPanel(stationInfo)`
- `hideTradingPanel()`
- `updateMiniMap(entities)`
- `updateWorld(worldName)`

**Dependencies**:
- Used by: tradeAll(), tradeHalf(), closeTrade(), startHUDUpdates(), SpaceControls.interact()
- DOM access: Multiple element IDs (ship-currency, cargo-capacity, etc.)

### 4. window.SpaceControls (Controls System)
**Created**: Line 732 in embedded JavaScript
**Type**: Object with methods and properties
**Properties**:
- `keys: {}` - Keyboard state

**Methods**:
- `init()`, `updateShipMovement(dt)`, `updateCamera(dt)`
- `handleCameraZoom(deltaY)`, `fireWeapon()`, `interact()`

**Dependencies**:
- Used by: initializeSpaceControls()
- Event listeners: keydown, keyup, wheel, app.on('update')

### 5. window.MMOEntities (Entities Registry)
**Created**: By handlers system (EntityHandler)
**Type**: `Map<string, pc.Entity>`
**Usage**:
- Entity storage and retrieval
- Physics initialization iteration
- Mini-map rendering
- Player ship discovery

**Dependencies**:
- Used by: SpaceHUD.updateMiniMap(), initializePhysics(), initializeSpaceControls()
- Entity access: forEach iteration, size property

### 6. window.playerShip (Player Ship Reference)
**Created**: Line 1079 in `initializeSpaceControls()`
**Type**: `pc.Entity`
**Usage**:
- Ship control operations
- HUD updates
- Trading interactions
- Camera following

**Dependencies**:
- Used by: All SpaceControls methods, HUD updates, trading functions
- Ship systems: shipController, cameraController, laserSystem, inventory

### 7. window.currentWorld (World Name)
**Created**: Line 696 in `SpaceHUD.updateWorld()`
**Type**: `string`
**Usage**:
- World name storage
- UI display

**Dependencies**:
- Used by: SpaceHUD.updateWorld()

## Event Listeners

### 1. Window Resize Handler
**Location**: Line 288 in `generatePlayCanvasInit()`
**Event**: `window.addEventListener('resize')`
**Handler**: `() => app.resizeCanvas()`
**Purpose**: Canvas responsive behavior

### 2. Keyboard Input Handlers
**Location**: Lines 740-754 in SpaceControls.init()
**Events**: 
- `window.addEventListener('keydown')`
- `window.addEventListener('keyup')`
**Handler**: Updates `this.keys[e.code]` state
**Purpose**: Ship movement controls (WASD+QZ)

### 3. Mouse Wheel Handler
**Location**: Lines 757-760 in SpaceControls.init()
**Event**: `window.addEventListener('wheel')`
**Handler**: `this.handleCameraZoom(e.deltaY)`
**Purpose**: Camera zoom control

### 4. PlayCanvas App Events
**Location**: Lines 763-766 in SpaceControls.init()
**Event**: `app.on('update')`
**Handler**: Updates ship movement and camera
**Purpose**: Game loop integration

**Location**: Lines 131, 220 in build methods
**Event**: `app.on('start')`
**Handler**: Calls `initializeSpaceControls()` and `startHUDUpdates()`
**Purpose**: Initialization after app start

## DOM Dependencies

### HUD Elements (Required by SpaceHUD)
- `ship-currency` - Currency display
- `cargo-capacity` - Cargo capacity text
- `cargo-bar` - Cargo progress bar
- `cargo-items` - Cargo items list
- `laser-status` - Laser system status
- `trading-panel` - Trading interface
- `station-name` - Station name display
- `mini-map-canvas` - Mini-map canvas
- `current-world` - World name display

### HTML Structure Dependencies
- Canvas element: `application-canvas`
- HUD container: `space-hud`
- Various panels and controls defined in HTML template

## Timers and Intervals

### 1. Initialization Timeout
**Location**: Lines 152, 232 in build methods
**Timer**: `setTimeout(() => { initializeSpaceControls(); }, 1000)`
**Purpose**: Fallback initialization

### 2. Physics Initialization Delay
**Location**: Line 1092 in `initializeSpaceControls()`
**Timer**: `setTimeout(() => { initializePhysics(); }, 500)`
**Purpose**: Ensure scene is fully loaded

### 3. HUD Update Interval
**Location**: Line 1099 in `startHUDUpdates()`
**Timer**: `setInterval(() => { window.SpaceHUD.updateShipStatus(); }, 1000)`
**Purpose**: Regular HUD updates

## Critical Preservation Requirements

### 1. Global Objects Lifecycle
- All window.* objects must be created in correct order
- References must remain accessible throughout application lifecycle
- Object methods and properties must be preserved

### 2. Event Listeners Management
- Event listeners must be attached after DOM is ready
- Proper cleanup and lifecycle management
- Event handler context preservation

### 3. DOM Access Patterns
- Element IDs must remain consistent
- DOM manipulation timing must be preserved
- Canvas and HUD element availability

### 4. Initialization Sequence
1. PlayCanvas app creation (window.app)
2. Camera setup (window.spaceCamera)
3. HTML document with embedded JavaScript
4. Global objects creation (SpaceHUD, SpaceControls)
5. App start event → initialization functions
6. Entity discovery and player ship assignment
7. Physics and controls initialization
8. HUD update loop start

## Refactoring Strategy

### GlobalObjectsManager Responsibilities
- Manage window.* objects lifecycle
- Ensure proper initialization order
- Provide access methods for global objects
- Handle cleanup if needed

### Event Listeners Management
- Centralize event listener attachment
- Ensure proper timing and context
- Provide cleanup mechanisms

### DOM Dependencies Handling
- Validate element availability
- Provide fallback mechanisms
- Maintain consistent element access patterns
