# PlayCanvasMMOOMMBuilder.ts Dependency Map

## Overview
**File Size**: 1,211 lines
**Target Reduction**: 70-80% (to 200-250 lines)
**Critical**: HTML-JavaScript hybrid with embedded systems

## Method Structure Analysis

### Core Builder Methods (Lines 1-250)
- `constructor()` - Lines 20-25 (5 lines)
- `build()` - Lines 30-71 (42 lines) **MAIN METHOD**
- `buildSingleScene()` - Lines 76-164 (89 lines)
- `buildMultiScene()` - Lines 169-244 (76 lines)

### PlayCanvas Initialization (Lines 249-333)
- `generatePlayCanvasInit()` - Lines 249-333 (85 lines)
  - Canvas setup, physics, lighting, camera
  - Global objects: `window.app`, `window.spaceCamera`

### Node Processing (Lines 338-361)
- `extractMMOOMMNodes()` - Lines 338-361 (24 lines)

### HTML-JavaScript Hybrid (Lines 366-1107)
- `generateMMOOMMDocument()` - Lines 366-1107 (742 lines) **CRITICAL**
  - Pure HTML structure: ~150 lines
  - Embedded JavaScript: ~592 lines

### Default Scene Generation (Lines 1116-1176)
- `generateErrorScene()` - Lines 1116-1161 (46 lines)
- `generateRotatorScriptCode()` - Lines 1166-1169 (4 lines)
- `generateDefaultScene()` - Lines 1174-1176 (3 lines)

### AbstractTemplateBuilder Implementation (Lines 1181-1211)
- `generateHTML()` - Lines 1181-1196 (16 lines) **STUB METHOD**
- `getTemplateInfo()` - Lines 1201-1203 (3 lines)
- `getRequiredLibraries()` - Lines 1208-1210 (3 lines)

## Embedded JavaScript Analysis (Lines 551-1106)

### window.SpaceHUD System (Lines 553-698)
- **Size**: ~145 lines
- **Methods**: updateShipStatus, showTradingPanel, hideTradingPanel, updateMiniMap, updateWorld
- **Dependencies**: DOM elements, window.MMOEntities, ship.inventory

### Trading Functions (Lines 700-729)
- **Size**: ~30 lines
- **Functions**: tradeAll, tradeHalf, closeTrade
- **Dependencies**: window.playerShip, window.SpaceHUD

### window.SpaceControls System (Lines 732-993)
- **Size**: ~261 lines
- **Methods**: init, updateShipMovement, updateCamera, handleCameraZoom, fireWeapon, interact
- **Dependencies**: window.addEventListener, window.playerShip, window.spaceCamera

### Physics & Initialization Functions (Lines 996-1105)
- **Size**: ~110 lines
- **Functions**: initializePhysics, initializeSpaceControls, startHUDUpdates
- **Dependencies**: window.MMOEntities, window.playerShip, window.SpaceControls, window.SpaceHUD

## Global Objects Dependencies

### Critical Window Objects
- `window.app` - PlayCanvas application instance
- `window.spaceCamera` - Main camera entity
- `window.SpaceHUD` - HUD system object
- `window.SpaceControls` - Controls system object
- `window.MMOEntities` - Entities registry
- `window.playerShip` - Player ship reference
- `window.currentWorld` - Current world name

### Event Listeners
- `window.addEventListener('resize')` - Canvas resize
- `window.addEventListener('keydown')` - Input handling
- `window.addEventListener('keyup')` - Input handling
- `window.addEventListener('wheel')` - Camera zoom

### DOM Dependencies
- `document.getElementById()` - HUD elements access
- HTML elements: ship-status, inventory-panel, trading-panel, mini-map, etc.

## Extraction Strategy

### Phase 2: HTML-JavaScript Hybrid
1. **HTMLDocumentGenerator** - Pure HTML structure (~150 lines)
2. **EmbeddedSystemsRegistry** - JavaScript injection management
3. **GlobalObjectsManager** - window.* lifecycle

### Phase 3: Embedded Systems
1. **EmbeddedHUDSystem** - window.SpaceHUD (~145 lines)
2. **EmbeddedControlsSystem** - window.SpaceControls (~261 lines)
3. **EmbeddedPhysicsSystem** - initializePhysics (~50 lines)
4. **EmbeddedHelperFunctions** - trading, initialization (~90 lines)

### Phase 4: Core Systems
1. **PlayCanvasInitializer** - generatePlayCanvasInit (~85 lines)
2. **SceneInitializer** - scene setup logic
3. **DefaultSceneGenerator** - error/default scenes (~50 lines)

## Risk Assessment

### High Risk
- HTML-JavaScript integration complexity
- Global objects interdependencies
- Event listeners lifecycle
- DOM elements access patterns

### Medium Risk
- Handler system integration
- AbstractTemplateBuilder compatibility
- Build method preservation

### Low Risk
- Pure JavaScript extraction
- Interface creation
- Documentation updates
