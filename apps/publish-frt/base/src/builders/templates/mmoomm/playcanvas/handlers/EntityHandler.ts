// Universo Platformo | MMOOMM Entity Handler
// Handles Entity nodes with networking capabilities for MMO

import { BuildOptions } from '../../../../common/types'
import { ComponentHandler } from './ComponentHandler'

export class EntityHandler {
    private componentHandler = new ComponentHandler()
    /**
     * Process array of Entity nodes for MMO environment
     */
    process(entities: any[], options: BuildOptions = {}): string {
        if (!entities || entities.length === 0) return ''

        return entities.map((entity) => this.processEntity(entity, options)).join('\n')
    }

    private processEntity(entity: any, options: BuildOptions): string {
        const entityId = entity.id || `entity_${Math.random().toString(36).substr(2, 9)}`
        const entityType = entity.data?.entityType || 'static'
        const position = entity.data?.transform?.position || { x: 0, y: 0, z: 0 }
        const rotation = entity.data?.transform?.rotation || { x: 0, y: 0, z: 0 }
        const scale = entity.data?.transform?.scale || { x: 1, y: 1, z: 1 }
        const isNetworked = entity.data?.networked || false
        const components = entity.data?.components || []

        return `
// MMO Entity: ${entityId}
(function() {
    const entity = new pc.Entity('${entityId}');
    
    // Transform setup
    entity.setLocalPosition(${position.x}, ${position.y}, ${position.z});
    entity.setLocalEulerAngles(${rotation.x}, ${rotation.y}, ${rotation.z});
    entity.setLocalScale(${scale.x}, ${scale.y}, ${scale.z});
    
    ${isNetworked ? this.generateNetworkComponent(entityId, entityType) : '// Local entity (not networked)'}
    
    // Entity type specific setup
    ${this.generateEntityTypeLogic(entityType, entityId)}

    // Attached components
    ${ components.map((c: any) => this.componentHandler.attach(c, 'entity')).join('\n    ') }
    
    // Add to scene
    app.root.addChild(entity);
    
    // Store reference for networking
    if (!window.MMOEntities) window.MMOEntities = new Map();
    window.MMOEntities.set('${entityId}', entity);
})();
`
    }

    private generateNetworkComponent(id: string, type: string): string {
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
`
    }

    private generateEntityTypeLogic(type: string, id: string): string {
        switch (type) {
            case 'player':
                return this.generatePlayerLogic(id)
            case 'interactive':
                return this.generateInteractiveLogic(id)
            case 'vehicle':
                return this.generateVehicleLogic(id)
            // Universo Platformo | Space MMO entity types
            case 'ship':
                return this.generateShipLogic(id)
            case 'station':
                return this.generateStationLogic(id)
            case 'asteroid':
                return this.generateAsteroidLogic(id)
            case 'gate':
                return this.generateGateLogic(id)
            default:
                return this.generateStaticLogic(id)
        }
    }

    private generatePlayerLogic(id: string): string {
        return `
    // Player entity setup
    entity.addComponent('model', { type: 'capsule' });
    entity.addComponent('rigidbody', { 
        type: pc.BODYTYPE_DYNAMIC,
        mass: 70 
    });
    entity.addComponent('collision', { 
        type: 'capsule',
        radius: 0.5,
        height: 1.8
    });
    
    // Player controller
    entity.playerController = {
        speed: 5,
        jumpForce: 8,
        isGrounded: false,
        
        move(direction) {
            if (this.isGrounded) {
                const force = direction.clone().scale(this.speed);
                entity.rigidbody.applyForce(force);
            }
        },
        
        jump() {
            if (this.isGrounded) {
                entity.rigidbody.applyImpulse(pc.Vec3.UP.clone().scale(this.jumpForce));
                this.isGrounded = false;
            }
        }
    };
`
    }

    private generateInteractiveLogic(id: string): string {
        return `
    // Interactive entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('collision', { type: 'box' });
    
    // Interaction handler
    entity.interaction = {
        canInteract: true,
        onInteract(player) {
            console.log('[MMO] Player', player.name, 'interacted with', '${id}');
            
            // Broadcast interaction to network
            if (window.UniversoGateway?.isConnected) {
                window.UniversoGateway.send({
                    type: 'entity_interaction',
                    entityId: '${id}',
                    playerId: player.networkId,
                    timestamp: Date.now()
                });
            }
        }
    };
`
    }

    private generateVehicleLogic(id: string): string {
        return `
    // Vehicle entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('rigidbody', { 
        type: pc.BODYTYPE_DYNAMIC,
        mass: 1000 
    });
    entity.addComponent('collision', { type: 'box' });
    
    // Vehicle controller
    entity.vehicleController = {
        speed: 0,
        maxSpeed: 20,
        acceleration: 5,
        
        accelerate() {
            this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
            this.updateMovement();
        },
        
        brake() {
            this.speed = Math.max(this.speed - this.acceleration, 0);
            this.updateMovement();
        },
        
        updateMovement() {
            const forward = entity.forward.clone().scale(this.speed);
            entity.rigidbody.linearVelocity = forward;
        }
    };
`
    }

    private generateStaticLogic(id: string): string {
        return `
    // Static entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('collision', { type: 'box' });

    // Add default material for visibility
    const staticMaterial = new pc.StandardMaterial();
    staticMaterial.diffuse.set(0.7, 0.7, 0.7); // Light gray
    staticMaterial.update();
    entity.model.material = staticMaterial;

    // Static entities are immovable but can have custom properties
    entity.staticData = {
        isStatic: true,
        entityId: '${id}'
    };
`
    }

    // Universo Platformo | Space MMO entity implementations

    private generateShipLogic(id: string): string {
        return `
    // Space ship entity setup
    entity.addComponent('model', { type: 'box' });

    // IMPORTANT: Add collision component first
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
        enabled: false  // Start disabled, will be enabled after entity is in scene
    });

    // Add ship material for visibility
    const shipMaterial = new pc.StandardMaterial();
    shipMaterial.diffuse.set(0.2, 0.8, 0.2); // Green for player ship
    shipMaterial.update();
    entity.model.material = shipMaterial;

    // Ship controller for space movement
    entity.shipController = {
        speed: 10,
        rotationSpeed: 50,
        thrustForce: 500,
        isThrusting: false,
        physicsInitialized: false,
        initializationAttempted: false,
        fallbackWarningShown: false,

        // Movement controls
        thrust(direction) {
            if (!entity.rigidbody) {
                if (!this.initializationAttempted) {
                    console.error('[ShipController] No rigidbody found on entity!');
                    this.initializationAttempted = true;
                }
                return;
            }

            // Try to initialize physics body if not already done
            if (!this.physicsInitialized && !this.initializationAttempted && !entity.rigidbody.body) {
                this.physicsInitialized = this.initializePhysics();
                this.initializationAttempted = true; // Mark as attempted regardless of success

                if (!this.physicsInitialized && !this.fallbackWarningShown) {
                    console.warn('[ShipController] Physics initialization failed, using direct movement fallback');
                    this.fallbackWarningShown = true;
                }
            }

            if (entity.rigidbody.body) {
                const force = direction.clone().scale(this.thrustForce);
                entity.rigidbody.applyForce(force);
            } else {
                // Fallback: direct position movement if physics doesn't work
                this.moveDirectly(direction);
            }

            this.isThrusting = true;
        },

        // Fallback movement method
        moveDirectly(direction) {
            const moveSpeed = this.speed * 0.016; // Approximate frame time
            const currentPos = entity.getPosition();
            const movement = direction.clone().scale(moveSpeed);
            entity.setPosition(currentPos.add(movement));
        },

        // Initialize physics body properly
        initializePhysics() {
            if (!entity.rigidbody) {
                console.error('[ShipController] No rigidbody component found');
                return false;
            }

            if (entity.rigidbody.body) {
                return true; // Already initialized
            }

            // Ensure entity is in scene hierarchy
            if (!entity.parent) {
                console.error('[ShipController] Entity not in scene hierarchy, cannot initialize physics');
                return false;
            }

            // Ensure collision component exists
            if (!entity.collision) {
                console.error('[ShipController] No collision component found, required for rigidbody');
                return false;
            }

            try {
                // Enable rigidbody component
                entity.rigidbody.enabled = true;

                // Try manual body creation if method exists
                if (!entity.rigidbody.body && typeof entity.rigidbody._createBody === 'function') {
                    entity.rigidbody._createBody();
                }

                // Check if body was created
                const success = !!entity.rigidbody.body;
                if (success) {
                    console.log('[ShipController] Physics body successfully initialized');
                }
                // Note: Failure message is handled in the calling method to avoid spam

                return success;
            } catch (error) {
                console.error('[ShipController] Error initializing physics:', error);
                return false;
            }
        },

        rotate(axis, angle) {
            if (entity.rigidbody && entity.rigidbody.body) {
                const torque = axis.clone().scale(angle * this.rotationSpeed);
                entity.rigidbody.applyTorque(torque);
            }
        },

        stopThrust() {
            this.isThrusting = false;
        }
    };

    // Ship inventory system
    entity.inventory = {
        maxCapacity: 20, // m³
        currentLoad: 0,
        items: {},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                return true;
            }
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];
                return true;
            }
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        }
    };

    // Ship weapon system
    entity.weaponSystem = {
        canFire: true,
        fireRate: 2, // shots per second
        lastFireTime: 0,

        fire(direction) {
            const now = Date.now();
            if (this.canFire && now - this.lastFireTime >= 1000 / this.fireRate) {
                this.createProjectile(direction);
                this.lastFireTime = now;
                return true;
            }
            return false;
        },

        createProjectile(direction) {
            // Create projectile entity
            const projectile = new pc.Entity('projectile_' + Date.now());
            projectile.addComponent('model', { type: 'sphere' });
            projectile.addComponent('rigidbody', {
                type: pc.BODYTYPE_DYNAMIC,
                mass: 0.1
            });
            projectile.addComponent('collision', {
                type: 'sphere',
                radius: 0.1
            });

            // Position projectile at ship's front
            const shipPos = entity.getPosition();
            const shipForward = entity.forward.clone();
            projectile.setPosition(shipPos.add(shipForward.scale(3)));

            // Apply velocity
            const velocity = direction.clone().scale(50);
            projectile.rigidbody.linearVelocity = velocity;

            // Add to scene
            app.root.addChild(projectile);

            // Auto-destroy after 5 seconds
            setTimeout(() => {
                if (projectile.parent) {
                    projectile.destroy();
                }
            }, 5000);

            console.log('[Ship] Projectile fired from', '${id}');
        }
    };
`
    }

    private generateStationLogic(id: string): string {
        return `
    // Space station entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(4, 2, 4)
    });
    entity.setLocalScale(4, 2, 4);

    // Add station material for visibility
    const stationMaterial = new pc.StandardMaterial();
    stationMaterial.diffuse.set(0.2, 0.5, 0.8); // Blue for stations
    stationMaterial.update();
    entity.model.material = stationMaterial;

    // Station trading system
    entity.tradingPost = {
        isActive: true,
        pricePerTon: 10, // Inmo per ton of asteroid mass
        interactionRange: 8,

        // Check if ship is in range
        isShipInRange(ship) {
            const distance = entity.getPosition().distance(ship.getPosition());
            return distance <= this.interactionRange;
        },

        // Trade asteroid mass for Inmo currency
        trade(ship, itemType, amount) {
            if (!this.isShipInRange(ship)) {
                return { success: false, message: 'Ship too far from station' };
            }

            if (!ship.inventory || !ship.inventory.items[itemType]) {
                return { success: false, message: 'No ' + itemType + ' in ship inventory' };
            }

            const availableAmount = ship.inventory.items[itemType];
            const tradeAmount = Math.min(amount, availableAmount);
            const payment = tradeAmount * this.pricePerTon;

            // Remove items from ship
            if (ship.inventory.removeItem(itemType, tradeAmount)) {
                // Add currency to ship
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;

                console.log('[Station] Traded', tradeAmount, itemType, 'for', payment, 'Inmo');
                return {
                    success: true,
                    amount: tradeAmount,
                    payment: payment,
                    message: 'Trade successful: +' + payment + ' Inmo'
                };
            }

            return { success: false, message: 'Trade failed' };
        },

        // Get trading info for UI
        getTradingInfo() {
            return {
                stationName: 'Station ${id}',
                pricePerTon: this.pricePerTon,
                currency: 'Inmo',
                acceptedItems: ['asteroidMass'],
                interactionRange: this.interactionRange
            };
        }
    };

    // Station interaction zone
    entity.interactionZone = {
        checkShips() {
            if (window.MMOEntities) {
                window.MMOEntities.forEach((otherEntity, entityId) => {
                    if (otherEntity.shipController && entity.tradingPost.isShipInRange(otherEntity)) {
                        // Ship entered trading range
                        if (!otherEntity.nearStation) {
                            otherEntity.nearStation = entity;
                            console.log('[Station] Ship', entityId, 'entered trading range');

                            // Trigger UI update
                            if (window.MMOEvents) {
                                window.MMOEvents.emit('ship_near_station', {
                                    shipId: entityId,
                                    stationId: '${id}',
                                    tradingInfo: entity.tradingPost.getTradingInfo()
                                });
                            }
                        }
                    } else if (otherEntity.nearStation === entity) {
                        // Ship left trading range
                        otherEntity.nearStation = null;
                        console.log('[Station] Ship', entityId, 'left trading range');

                        if (window.MMOEvents) {
                            window.MMOEvents.emit('ship_left_station', {
                                shipId: entityId,
                                stationId: '${id}'
                            });
                        }
                    }
                });
            }
        }
    };

    // Check for ships every second
    setInterval(() => {
        entity.interactionZone.checkShips();
    }, 1000);
`
    }

    private generateAsteroidLogic(id: string): string {
        return `
    // Asteroid entity setup
    entity.addComponent('model', { type: 'sphere' });
    entity.addComponent('collision', {
        type: 'sphere',
        radius: Math.random() * 2 + 1 // Random size between 1-3
    });
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_STATIC,
        mass: 0
    });

    // Random scale for visual variety
    const scale = Math.random() * 2 + 0.5; // 0.5 to 2.5
    entity.setLocalScale(scale, scale, scale);

    // Add asteroid material for visibility
    const asteroidMaterial = new pc.StandardMaterial();
    asteroidMaterial.diffuse.set(0.6, 0.5, 0.4); // Brown/gray for asteroids
    asteroidMaterial.update();
    entity.model.material = asteroidMaterial;

    // Asteroid mineable properties
    entity.mineable = {
        resourceType: 'asteroidMass',
        maxYield: scale * 2, // Larger asteroids yield more
        currentYield: scale * 2,
        isDestroyed: false,

        // Handle being hit by projectile
        onHit(projectile) {
            if (this.isDestroyed) return false;

            // Reduce yield
            const damage = 0.5;
            this.currentYield -= damage;

            console.log('[Asteroid] Hit! Remaining yield:', this.currentYield);

            // Create resource pickup
            if (this.currentYield <= 0) {
                this.destroy();
                return true;
            } else {
                // Visual feedback - flash red
                this.flashDamage();
                return false;
            }
        },

        // Destroy asteroid and create resource pickup
        destroy() {
            this.isDestroyed = true;

            // Create resource pickup
            const pickup = new pc.Entity('pickup_' + Date.now());
            pickup.addComponent('model', { type: 'sphere' });
            pickup.addComponent('collision', {
                type: 'sphere',
                radius: 0.3
            });
            pickup.setLocalScale(0.3, 0.3, 0.3);
            pickup.setPosition(entity.getPosition());

            // Pickup properties
            pickup.resourcePickup = {
                resourceType: this.resourceType,
                amount: this.maxYield,

                // Collect by ship
                collect(ship) {
                    if (ship.inventory && ship.inventory.addItem(this.resourceType, this.amount)) {
                        console.log('[Pickup] Collected', this.amount, this.resourceType);
                        pickup.destroy();
                        return true;
                    }
                    return false;
                }
            };

            // Auto-collect when ship touches
            pickup.collision.on('triggerenter', (otherEntity) => {
                if (otherEntity.shipController) {
                    pickup.resourcePickup.collect(otherEntity);
                }
            });

            // Add to scene
            app.root.addChild(pickup);

            // Auto-destroy pickup after 30 seconds
            setTimeout(() => {
                if (pickup.parent) {
                    pickup.destroy();
                }
            }, 30000);

            // Destroy asteroid
            entity.destroy();

            console.log('[Asteroid] Destroyed, created resource pickup');
        },

        // Visual damage feedback
        flashDamage() {
            // Simple color flash effect
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(1, 0, 0); // Flash red
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 200);
            }
        }
    };

    // Handle collision with projectiles
    entity.collision.on('collisionstart', (result) => {
        const otherEntity = result.other;
        if (otherEntity.name && otherEntity.name.startsWith('projectile_')) {
            entity.mineable.onHit(otherEntity);
            otherEntity.destroy(); // Destroy projectile
        }
    });

    // Slow rotation for visual effect
    entity.rotationSpeed = (Math.random() - 0.5) * 10; // Random rotation speed
    entity.on('update', (dt) => {
        if (!entity.mineable.isDestroyed) {
            entity.rotateLocal(0, entity.rotationSpeed * dt, 0);
        }
    });
`
    }

    private generateGateLogic(id: string): string {
        return `
    // Gate (Portal) entity setup
    entity.addComponent('model', { type: 'torus' });
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(3, 3, 1)
    });
    entity.setLocalScale(3, 3, 1);

    // Add gate material for visibility
    const gateMaterial = new pc.StandardMaterial();
    gateMaterial.diffuse.set(1, 1, 0); // Yellow for gates
    gateMaterial.emissive.set(0.2, 0.2, 0); // Slight glow
    gateMaterial.update();
    entity.model.material = gateMaterial;

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

            // Trigger world change event
            if (window.MMOEvents) {
                window.MMOEvents.emit('world_change', {
                    shipId: ship.name,
                    fromWorld: window.currentWorld || 'kubio',
                    toWorld: this.targetWorld,
                    gateId: '${id}'
                });
            }

            // Visual effect - flash gate
            this.flashPortal();

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

    // Pulsing scale effect
    entity.pulseTime = 0;
    entity.on('update', (dt) => {
        entity.pulseTime += dt;
        const pulse = 1 + Math.sin(entity.pulseTime * 2) * 0.1;
        entity.setLocalScale(3 * pulse, 3 * pulse, 1);
    });
`
    }
}
