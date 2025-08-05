export function generateNetworkComponent(id: string, type: string): string {
    return `
    // Network synchronization component
    entity.networked = true;
    entity.networkId = '${id}';
    entity.entityType = '${type}';

    // Position sync handler
    entity.on('position:change', (pos) => {
        if (window.UniversoGateway?.isConnected) {
            window.UniversoGateway.send({
                type: 'entity_update',
                id: '${id}',
                position: pos,
                timestamp: Date.now()
            });
        }
    });
    `;
}

/**
  * Transform helper for conditional application of UPDL settings.
  * Checks whether values from UPDL have already been set.
  */

export function shouldApplyDefaultTransform(
    entity: any,
    property: 'position' | 'rotation' | 'scale'
): boolean {
    const current = getCurrentTransform(entity, property);
    const defaultValues = { x: 0, y: 0, z: 0 };
    const defaultScale = { x: 1, y: 1, z: 1 };
    
    const defaults = property === 'scale' ? defaultScale : defaultValues;
    
    return (
        current.x === defaults.x &&
        current.y === defaults.y &&
        current.z === defaults.z
    );
}

/**
 * Get current transform value
 */
function getCurrentTransform(entity: any, property: string): { x: number; y: number; z: number } {
    switch (property) {
        case 'position':
            return entity.getLocalPosition();
        case 'rotation':
            return entity.getLocalEulerAngles();
        case 'scale':
            return entity.getLocalScale();
        default:
            return { x: 0, y: 0, z: 0 };
    }
}

/**
 * Safely apply default values only if not set from UPDL
 */
export function safelyApplyDefaultTransform(
    entity: any,
    property: 'position' | 'rotation' | 'scale',
    defaultValue: { x: number; y: number; z: number }
): void {
    if (shouldApplyDefaultTransform(entity, property)) {
        switch (property) {
            case 'position':
                entity.setLocalPosition(defaultValue.x, defaultValue.y, defaultValue.z);
                break;
            case 'rotation':
                entity.setLocalEulerAngles(defaultValue.x, defaultValue.y, defaultValue.z);
                break;
            case 'scale':
                entity.setLocalScale(defaultValue.x, defaultValue.y, defaultValue.z);
                break;
        }
        console.log(`[Entity] Applied default ${property}:`, defaultValue);
    } else {
        console.log(`[Entity] Preserving UPDL ${property} values`);
    }
}

/**
 * Get base scale for animation (UPDL or default)
 */
export function getBaseScaleForAnimation(entity: any, defaultScale: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return shouldApplyDefaultTransform(entity, 'scale') ? defaultScale : entity.getLocalScale();
}
