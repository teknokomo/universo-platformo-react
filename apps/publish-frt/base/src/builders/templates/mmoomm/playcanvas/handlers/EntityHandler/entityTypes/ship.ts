import { generateShipControllerCode } from '../../shared/shipSystems/shipControllerTemplate'
import { generateCameraControllerCode } from '../../shared/shipSystems/cameraControllerTemplate'
import { generateLaserMiningCode } from '../../shared/shipSystems/laserMiningTemplate'
import { generateInventoryCode } from '../../shared/inventoryTemplate'

export function generateShipLogic(id: string): string {
    return `
    // Space ship entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'box' });
    }

    // IMPORTANT: Add collision component first (always needed for game mechanics)
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(1, 0.5, 2)
    });

    // Add rigidbody component after collision
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_DYNAMIC,
        mass: 100,
        linearDamping: 0.1,
        angularDamping: 0.1,
        enabled: true  // FIXED: Start enabled for immediate physics
    });

    // IMPROVED: Enhanced ship material (only if no custom material from Component)
    if (entity.model && !entity.model.material) {
        const shipMaterial = new pc.StandardMaterial();
        shipMaterial.diffuse.set(0.2, 0.8, 0.2); // Green for player ship
        shipMaterial.emissive.set(0.1, 0.4, 0.1); // Slight glow
        shipMaterial.shininess = 40;
        shipMaterial.metalness = 0.3;
        shipMaterial.update();
        entity.model.material = shipMaterial;
    }

    // ADDED: Ensure entity is visible and properly scaled
    entity.enabled = true;
    
    // Apply default transform values only if not set by UPDL  
    // Ship default scale: wider and longer for visibility
    const currentScale = entity.getLocalScale();
    if (currentScale.x === 1 && currentScale.y === 1 && currentScale.z === 1) {
        entity.setLocalScale(2, 1, 3);
        console.log('[Ship] Applied default scale: { x: 2, y: 1, z: 3 }');
    } else {
        console.log('[Ship] Preserving UPDL scale values');
    }
    
    // Ship default rotation: nose pointing forward in +Z direction
    const currentRotation = entity.getLocalEulerAngles();
    if (currentRotation.x === 0 && currentRotation.y === 0 && currentRotation.z === 0) {
        entity.setLocalEulerAngles(0, 0, 0);
        console.log('[Ship] Applied default rotation: { x: 0, y: 0, z: 0 }');
    } else {
        console.log('[Ship] Preserving UPDL rotation values');
    }

    // ADDED: Debug ship creation
    console.log('[Ship] Created ship entity with position:', entity.getPosition().toString());
    console.log('[Ship] Initial rotation set to:', entity.getLocalEulerAngles().toString());

    // Ship controller for rotation-based space movement (using shared template)
    entity.shipController = ${generateShipControllerCode(10, 60, 500, false, true)};

    // Ship inventory system (using shared template)
    entity.inventory = ${generateInventoryCode(20, 0, true, true, true)};

    // Camera controller for ship following (using shared template)
    entity.cameraController = ${generateCameraControllerCode(18, 4.0, false, true)};

    // Ship laser mining system (using shared template)
    entity.laserSystem = ${generateLaserMiningCode(75, 3000, 1.5, false, true)};

    // ADDED: Initialize camera to follow this ship
    if (window.spaceCamera) {
        entity.cameraController.target = entity;
        entity.cameraController.initializeCamera();
        console.log('[Ship] Camera controller initialized for ship');
    }

    // Initialize laser system
    if (entity.laserSystem && entity.laserSystem.init) {
        entity.laserSystem.init();
    }

    // ADDED: Laser system update loop using app.on('update')
    app.on('update', (dt) => {
        if (entity.laserSystem && entity.laserSystem.update) {
            entity.laserSystem.update(dt);
        }
    });
`;
}
