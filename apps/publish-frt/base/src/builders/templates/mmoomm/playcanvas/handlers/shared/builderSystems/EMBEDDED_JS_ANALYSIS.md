# Embedded JavaScript Analysis

## Overview
**Location**: `generateMMOOMMDocument()` method, lines 366-1107
**Total Embedded JS**: ~550 lines within HTML template strings
**Critical**: All JavaScript is embedded as strings within HTML generation

## Detailed Breakdown

### 1. window.SpaceHUD System (Lines 553-698)
**Size**: 145 lines
**Location**: Within `<script>` tag in HTML template

#### Methods Analysis:
- `updateShipStatus(ship)` - Lines 555-627 (73 lines)
  - Updates currency display
  - Updates inventory capacity and items
  - Updates laser system status
  - **DOM Dependencies**: ship-currency, cargo-capacity, cargo-bar, cargo-items, laser-status

- `showTradingPanel(stationInfo)` - Lines 629-636 (8 lines)
  - Shows trading interface
  - **DOM Dependencies**: trading-panel, station-name

- `hideTradingPanel()` - Lines 638-640 (3 lines)
  - Hides trading interface
  - **DOM Dependencies**: trading-panel

- `updateMiniMap(entities)` - Lines 642-691 (50 lines)
  - Draws mini-map canvas
  - **DOM Dependencies**: mini-map-canvas
  - **Global Dependencies**: window.MMOEntities

- `updateWorld(worldName)` - Lines 693-697 (5 lines)
  - Updates world name display
  - **DOM Dependencies**: current-world
  - **Global Dependencies**: window.currentWorld

#### Dependencies:
- **DOM Elements**: 8 specific element IDs
- **Global Objects**: window.MMOEntities, window.currentWorld
- **Ship Properties**: currency, inventory, laserSystem

### 2. Trading Helper Functions (Lines 700-729)
**Size**: 30 lines

#### Functions Analysis:
- `tradeAll()` - Lines 701-714 (14 lines)
  - **Global Dependencies**: window.playerShip, window.SpaceHUD
  - **Ship Dependencies**: nearStation, inventory

- `tradeHalf()` - Lines 716-725 (10 lines)
  - **Global Dependencies**: window.playerShip, window.SpaceHUD
  - **Ship Dependencies**: nearStation, inventory

- `closeTrade()` - Lines 727-729 (3 lines)
  - **Global Dependencies**: window.SpaceHUD

### 3. window.SpaceControls System (Lines 732-993)
**Size**: 261 lines
**Location**: Within `<script>` tag in HTML template

#### Properties:
- `keys: {}` - Keyboard state tracking

#### Methods Analysis:
- `init()` - Lines 736-772 (37 lines)
  - Sets up event listeners
  - **Event Dependencies**: keydown, keyup, wheel, app.on('update')
  - **Global Dependencies**: window.addEventListener, app

- `updateShipMovement(dt)` - Lines 775-894 (120 lines)
  - WASD+QZ ship controls
  - Rotation and strafe logic
  - **Global Dependencies**: window.playerShip
  - **Ship Dependencies**: shipController

- `showControlInstructions()` - Lines 897-919 (23 lines)
  - Console output for controls
  - No dependencies

- `updateCamera(dt)` - Lines 922-935 (14 lines)
  - Camera following logic
  - **Global Dependencies**: window.playerShip, window.spaceCamera
  - **Ship Dependencies**: cameraController

- `basicCameraFollow()` - Lines 938-950 (13 lines)
  - Fallback camera logic
  - **Global Dependencies**: window.spaceCamera

- `handleCameraZoom(deltaY)` - Lines 953-967 (15 lines)
  - Mouse wheel zoom
  - **Global Dependencies**: window.playerShip
  - **Ship Dependencies**: cameraController

- `fireWeapon()` - Lines 970-982 (13 lines)
  - Laser mining activation
  - **Global Dependencies**: window.playerShip
  - **Ship Dependencies**: laserSystem

- `interact()` - Lines 985-992 (8 lines)
  - Trading interaction
  - **Global Dependencies**: window.playerShip, window.SpaceHUD
  - **Ship Dependencies**: nearStation

#### Dependencies:
- **Event Listeners**: keydown, keyup, wheel, app.on('update')
- **Global Objects**: window.playerShip, window.spaceCamera, window.SpaceHUD
- **Ship Systems**: shipController, cameraController, laserSystem

### 4. Physics & Initialization Functions (Lines 996-1105)
**Size**: 110 lines

#### Functions Analysis:
- `initializePhysics()` - Lines 996-1047 (52 lines)
  - Physics bodies initialization
  - **Global Dependencies**: window.MMOEntities, app.systems.rigidbody
  - **Entity Dependencies**: rigidbody component

- `initializeSpaceControls()` - Lines 1050-1095 (46 lines)
  - Controls system initialization
  - **Global Dependencies**: window.SpaceControls, window.MMOEntities, window.playerShip
  - **Function Dependencies**: initializePhysics()

- `startHUDUpdates()` - Lines 1098-1105 (8 lines)
  - HUD update loop
  - **Global Dependencies**: window.playerShip, window.SpaceHUD

#### Dependencies:
- **Global Objects**: window.MMOEntities, window.playerShip, window.SpaceControls, window.SpaceHUD
- **PlayCanvas**: app.systems.rigidbody
- **Timers**: setTimeout, setInterval

## Extraction Strategy

### Phase 3.1: EmbeddedHUDSystem
**Target**: Extract window.SpaceHUD (145 lines)
**Template**: `embeddedHUDTemplate.ts`
**Interface**: `IEmbeddedHUDSystem`
**Preserve**: window.SpaceHUD global object

### Phase 3.2: EmbeddedControlsSystem  
**Target**: Extract window.SpaceControls (261 lines)
**Template**: `embeddedControlsTemplate.ts`
**Interface**: `IEmbeddedControlsSystem`
**Preserve**: window.SpaceControls global object

### Phase 3.3: EmbeddedPhysicsSystem
**Target**: Extract initializePhysics (52 lines)
**Template**: `embeddedPhysicsTemplate.ts`
**Interface**: `IEmbeddedPhysicsSystem`

### Phase 3.4: EmbeddedHelperFunctions
**Target**: Extract trading + initialization functions (84 lines)
**Template**: `embeddedHelpersTemplate.ts`
**Interface**: `IEmbeddedHelperFunctions`

## Critical Considerations

### Global Objects Preservation
- All window.* objects must remain accessible
- Event listeners must be properly attached
- DOM element access patterns must be preserved

### Injection Strategy
- JavaScript must be injected as strings into HTML
- Proper escaping and formatting required
- Execution order must be maintained

### Dependencies Management
- Global objects interdependencies
- Event listeners lifecycle
- DOM elements availability timing
