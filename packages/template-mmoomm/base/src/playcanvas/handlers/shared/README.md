# Shared Components Documentation

This directory contains shared templates and utilities used across MMOOMM handlers to ensure consistency and eliminate code duplication.

## Overview

Shared components provide reusable implementations for common game mechanics that are used by multiple UPDL node types. These components follow the DRY (Don't Repeat Yourself) principle and provide a single source of truth for core functionality.

### Available Components

-   **Inventory System**: Resource management and cargo handling for space entities
-   **Ship Systems**: Complete ship functionality including movement, camera, and laser mining
-   **Future Components**: Placeholder for additional shared systems

## Inventory System

The Inventory System provides comprehensive resource management capabilities for space MMO gameplay, supporting mining, trading, crafting, and cargo management mechanics.

### Purpose

The inventory system serves as the foundation for resource-based gameplay in the MMOOMM template:

-   **Mining Operations**: Store resources collected from asteroid mining
-   **Trading Mechanics**: Manage cargo for station-based commerce
-   **Crafting Systems**: Handle materials for item production
-   **Quest Systems**: Track quest items and deliverables
-   **Fuel Management**: Monitor consumable resources

### Architecture

The inventory system uses a shared template approach with configurable options to support different use cases:

```typescript
// Core interface
interface InventorySystem {
    maxCapacity: number // Maximum storage capacity (m³)
    currentLoad: number // Current cargo load (m³)
    items: Record<string, number> // Item type → quantity mapping
    addItem(itemType: string, amount: number): boolean
    removeItem(itemType: string, amount: number): boolean
    getCapacityInfo(): CapacityInfo
    getItemList?(): ItemInfo[] // Optional for HUD integration
}
```

### API Reference

#### `createInventorySystem(maxCapacity, currentLoad, includeItemList)`

Creates a runtime inventory system object for direct use in JavaScript.

**Parameters:**

-   `maxCapacity: number` - Maximum cargo capacity in cubic meters (default: 20)
-   `currentLoad: number` - Initial cargo load in cubic meters (default: 0)
-   `includeItemList: boolean` - Whether to include getItemList method for HUD integration (default: false)

**Returns:** `InventorySystem` - Configured inventory object

**Example:**

```typescript
const shipInventory = createInventorySystem(50, 0, true)
shipInventory.addItem('asteroidMass', 1.5)
```

#### `generateInventoryCode(maxCapacity, currentLoad, includeItemList, includeLogging, includeEvents)`

Generates JavaScript code string for inventory system integration in templates.

**Parameters:**

-   `maxCapacity: number` - Maximum cargo capacity in cubic meters (default: 20)
-   `currentLoad: number` - Initial cargo load in cubic meters (default: 0)
-   `includeItemList: boolean` - Include getItemList method (default: false)
-   `includeLogging: boolean` - Include console logging for operations (default: false)
-   `includeEvents: boolean` - Include app.fire events for UI updates (default: false)

**Returns:** `string` - JavaScript code for inventory object

**Example:**

```typescript
const code = generateInventoryCode(20, 0, true, true, true)
// Generates full-featured inventory with logging and events
```

### Integration Patterns

#### UPDL Component Flow

When a UPDL Component node with type "inventory" is processed:

```
UPDL Component Node (inventory)
  ↓
EntityHandler.processEntity()
  ↓
componentHandler.attach(component, 'entity')
  ↓
attachments/inventory.ts
  ↓
generateInventoryCode() → entity.inventory = { ... }
```

#### Standalone Component Usage

For independent component processing:

```
ComponentHandler.process()
  ↓
components/inventory.ts
  ↓
generateInventoryCode() → const inventoryComponent = { ... }
```

#### Ship Entity Integration

Direct integration in entity types:

```typescript
// In ship.ts
entity.inventory = createInventorySystem(20, 0, true)
```

### Usage Examples

#### Basic Attachment (attachments/inventory.ts)

```typescript
import { generateInventoryCode } from '../../shared/inventoryTemplate'

export default function inventoryAttachment(component: any, entityVar: string): string {
    const maxCapacity = component.data?.maxCapacity || 20
    const currentLoad = component.data?.currentLoad || 0

    return `
    // Attach inventory component ${component.id}
    ${entityVar}.inventory = ${generateInventoryCode(maxCapacity, currentLoad, false)};
    `
}
```

#### Full-Featured Component (components/inventory.ts)

```typescript
import { generateInventoryCode } from '../../shared/inventoryTemplate'

export default function inventory(id: string, props: any): string {
    const maxCapacity = props.maxCapacity || 20
    const currentLoad = props.currentLoad || 0

    return `
    // Inventory component for space ships
    const inventoryComponent = ${generateInventoryCode(maxCapacity, currentLoad, true, true, true)};
    
    console.log('[MMO Component] Inventory component ${id} ready');
    `
}
```

#### Ship Entity Integration (ship.ts)

```typescript
// Ship inventory system
entity.inventory = {
    maxCapacity: 20, // m³
    currentLoad: 0,
    items: {}
    // ... methods from shared template
}
```

### Game Mechanics Integration

#### Mining System Integration

```javascript
// Laser mining adds resources to inventory
if (entity.inventory.addItem('asteroidMass', resourceAmount)) {
    console.log('[LaserSystem] Collected ' + resourceAmount + ' asteroidMass')

    // Update HUD if available
    if (window.SpaceHUD) {
        window.SpaceHUD.updateShipStatus(entity)
    }
}
```

#### Trading System Integration

```javascript
// Station trading removes items and adds currency
if (ship.inventory.removeItem('asteroidMass', amount)) {
    playerData.inmo += amount * pricePerTon
    console.log('[Trading] Sold ' + amount + ' asteroidMass for ' + amount * pricePerTon + ' Inmo')
}
```

Note on interaction distance:
- The `Interaction Range` field of the Trading component is now interpreted as the distance from the nearest point on the station's external bounds (world-space AABB) to the ship, not from the station's center.
- This means that for large stations, interaction becomes available at the surface without needing to fly “inside”. The station's `scale` and its child nodes are considered when computing the AABB.
- If meshes are temporarily unavailable for a station (rare case), a safe fallback to center distance is used until geometry becomes available.

#### HUD Integration

```javascript
// Display cargo status in UI
const cargo = ship.inventory?.getCapacityInfo() || { current: 0, max: 20 }
document.getElementById('ship-cargo').textContent = cargo.current.toFixed(1) + '/' + cargo.max + ' m³'
```

### Extending the System

#### Adding New Item Types

The system supports any string-based item type:

```javascript
inventory.addItem('crystals', 5)
inventory.addItem('fuel', 10.5)
inventory.addItem('laserCannon', 1)
inventory.addItem('questItem_dataCore', 1)
```

#### Custom Capacity Logic

Override capacity checking for special items:

```javascript
// Example: Quest items don't count toward capacity
addItem(itemType, amount) {
    if (itemType.startsWith('quest_')) {
        this.items[itemType] = (this.items[itemType] || 0) + amount;
        return true;
    }
    // Standard capacity logic
    if (this.currentLoad + amount <= this.maxCapacity) {
        // ... standard implementation
    }
}
```

#### Event Integration

The system supports PlayCanvas app events for UI updates:

```javascript
// Automatically fired when includeEvents: true
app.fire('cargo:changed', this.currentLoad, this.maxCapacity)

// Listen for events in UI components
app.on('cargo:changed', (current, max) => {
    updateCargoDisplay(current, max)
})
```

### Troubleshooting

#### Common Issues

**Inventory not found on entity:**

-   Ensure UPDL Component with type "inventory" is connected to Entity
-   Check that attachments/inventory.ts is properly imported in ComponentHandler

**Capacity exceeded errors:**

-   Verify maxCapacity is set correctly in UPDL Component data
-   Check that mining system respects capacity limits

**HUD not updating:**

-   Ensure includeItemList: true for entities that need HUD integration
-   Verify SpaceHUD is available in global scope

**Events not firing:**

-   Set includeEvents: true in generateInventoryCode calls
-   Ensure PlayCanvas app is available in global scope

#### Debug Information

Enable logging by setting includeLogging: true:

```javascript
// Will output detailed operation logs
[Inventory] Added 1.5 asteroidMass - Load: 1.5/20
[Inventory] Cannot add 25 asteroidMass - Insufficient space
[Inventory] Removed 1.5 asteroidMass - Load: 0/20
```

## Ship Systems

The Ship Systems provide comprehensive space ship functionality for the MMOOMM template, including movement control, camera following, and laser mining capabilities.

### Purpose

The ship systems serve as the foundation for space ship gameplay in the MMOOMM template:

-   **Movement Control**: Physics-based and fallback movement with quaternion rotation
-   **Camera Following**: Smooth camera tracking with rotation awareness
-   **Laser Mining**: Industrial laser mining with state machine and auto-targeting
-   **Modular Design**: Each system can be used independently or together

### Architecture

The ship systems use a modular template approach with three main components located in `shipSystems/`:

#### Ship Controller Template

-   **File**: `shipControllerTemplate.ts`
-   **Purpose**: Movement and rotation control with physics fallback
-   **Key Features**: WASD+QZ controls, quaternion rotation, gimbal lock prevention

#### Camera Controller Template

-   **File**: `cameraControllerTemplate.ts`
-   **Purpose**: Smooth camera following with ship rotation tracking
-   **Key Features**: Rigid attachment, smooth interpolation, NaN protection

#### Laser Mining Template

-   **File**: `laserMiningTemplate.ts`
-   **Purpose**: Industrial laser mining with state machine
-   **Key Features**: Auto-targeting, 3-second cycles, inventory integration

### Usage Example

```typescript
import { generateShipControllerCode } from '../../shared/shipSystems/shipControllerTemplate';
import { generateCameraControllerCode } from '../../shared/shipSystems/cameraControllerTemplate';
import { generateLaserMiningCode } from '../../shared/shipSystems/laserMiningTemplate';

// Complete ship entity with all systems
entity.shipController = ${generateShipControllerCode(10, 60, 500, false, true)};
entity.cameraController = ${generateCameraControllerCode(15, 4.0, false, true)};
entity.laserSystem = ${generateLaserMiningCode(75, 3000, 1.5, false, true)};
```

### Benefits

-   **Code Reduction**: Ship.ts reduced from 894 lines to 84 lines (90.6% reduction)
-   **Maintainability**: Single source of truth for each ship system
-   **Reusability**: Systems can be used across different entity types
-   **Consistency**: Standardized interfaces and behavior

## Future Shared Components

This directory is designed to accommodate additional shared components as the MMOOMM template evolves:

-   **Weapon Systems**: Shared laser and projectile mechanics
-   **Physics Utilities**: Common physics calculations and constraints
-   **Networking Components**: Multiplayer synchronization helpers
-   **UI Components**: Reusable interface elements

Each new shared component should follow the same pattern:

1. TypeScript interface definition
2. Factory function for runtime objects
3. Code generation function for templates
4. Comprehensive documentation with examples
