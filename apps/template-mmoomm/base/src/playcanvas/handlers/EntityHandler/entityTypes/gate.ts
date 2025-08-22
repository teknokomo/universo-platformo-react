export function generateGateLogic(id: string): string {
    return `
    // Gate (Portal) entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'torus' });
    }

    // Collision setup (always needed for portal detection)
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(3, 3, 1)
    });
    
    // Apply default scale only if not set by UPDL
    // Store default for animation use
    const defaultGateScale = { x: 3, y: 3, z: 1 };
    const currentScale = entity.getLocalScale();
    if (currentScale.x === 1 && currentScale.y === 1 && currentScale.z === 1) {
        entity.setLocalScale(defaultGateScale.x, defaultGateScale.y, defaultGateScale.z);
        console.log('[Gate] Applied default scale:', defaultGateScale);
    } else {
        console.log('[Gate] Preserving UPDL scale values');
    }

    // Add gate material (only if no custom render component applied)
    if (entity.model && !entity.__hasRenderComponent) {
        const gateMaterial = new pc.StandardMaterial();
        gateMaterial.diffuse.set(1, 1, 0); // Yellow for gates
        gateMaterial.emissive.set(0.2, 0.2, 0); // Slight glow
        gateMaterial.update();
        entity.model.material = gateMaterial;
        if (entity.model && entity.model.meshInstances) {
            entity.model.meshInstances.forEach(function(mi){ mi.material = gateMaterial; });
        }
    }

    // Gate portal properties
    entity.portal = {
        targetWorld: 'konkordo', // Default target world
        isActive: true,
        cooldownTime: 2000, // 2 seconds between uses
        lastUsed: 0,

        // Set target world
        setTarget(worldName) {
            this.targetWorld = worldName;
            console.log('[Gate] Target set to:', worldName);
        },

        // Check if ship can use portal
        canUse(ship) {
            const now = Date.now();
            return this.isActive && (now - this.lastUsed >= this.cooldownTime);
        },

        // Transport ship to target world
        transport(ship) {
            if (!this.canUse(ship)) {
                console.log('[Gate] Portal on cooldown');
                return false;
            }

            this.lastUsed = Date.now();

            console.log('[Gate] Transporting ship to', this.targetWorld);

            // IMPROVED: World switching with proper cleanup
            if (window.MMOSpace && typeof window.MMOSpace.switchWorld === 'function') {
                window.MMOSpace.switchWorld(this.targetWorld);
            }

            // Trigger world change event
            if (window.MMOEvents) {
                window.MMOEvents.emit('world_change', {
                    shipId: ship.name,
                    fromWorld: window.MMOSpace?.name || 'kubio',
                    toWorld: this.targetWorld,
                    gateId: '${id}'
                });
            }

            // Visual effect - flash gate
            this.flashPortal();

            // ADDED: Simulate world reload (in real implementation this would reload the scene)
            setTimeout(() => {
                console.log('[Gate] World switch simulation complete - would reload scene with', this.targetWorld, 'entities');
                // In real implementation: location.reload() or scene reconstruction
            }, 1000);

            return true;
        },

        // Visual portal effect
        flashPortal() {
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(0, 1, 1); // Flash cyan
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 500);
            }
        },

        // Get portal info for UI
        getPortalInfo() {
            return {
                gateName: 'Gate ${id}',
                targetWorld: this.targetWorld,
                isActive: this.isActive,
                cooldownRemaining: Math.max(0, this.cooldownTime - (Date.now() - this.lastUsed))
            };
        }
    };

    // Handle ship collision
    entity.collision.on('triggerenter', (otherEntity) => {
        if (otherEntity.shipController) {
            console.log('[Gate] Ship entered portal zone');

            // Auto-transport or show UI
            if (entity.portal.canUse(otherEntity)) {
                // For now, auto-transport. Later can add confirmation UI
                entity.portal.transport(otherEntity);
            }
        }
    });

    // Rotation animation for visual effect
    entity.on('update', (dt) => {
        entity.rotateLocal(0, 0, 30 * dt); // Rotate around Z-axis
    });

    // Pulsing scale effect (respects UPDL scale values)
    entity.pulseTime = 0;
    // Store base scale for animation (either UPDL or default)
    const baseScale = entity.getLocalScale();
    entity.on('update', (dt) => {
        entity.pulseTime += dt;
        const pulse = 1 + Math.sin(entity.pulseTime * 2) * 0.1;
        entity.setLocalScale(baseScale.x * pulse, baseScale.y * pulse, baseScale.z * pulse);
    });
`;
}
