// Universo Platformo | MMOOMM Component Handler
// Handles Component nodes for MMO-specific components

import { BuildOptions } from '../../../../../common/types'

export class ComponentHandler {
    process(components: any[], options: BuildOptions = {}): string {
        if (!components || components.length === 0) return ''

        return components.map((component) => this.processComponent(component, options)).join('\n')
    }

    attach(component: any, entityVar: string): string {
        const type = component.data?.componentType || 'custom'
        switch (type) {
            case 'render':
                return this.generateRenderAttachment(component, entityVar)
            // Universo Platformo | Space MMO components
            case 'inventory':
                return this.generateInventoryAttachment(component, entityVar)
            case 'trading':
                return this.generateTradingAttachment(component, entityVar)
            case 'mineable':
                return this.generateMineableAttachment(component, entityVar)
            case 'portal':
                return this.generatePortalAttachment(component, entityVar)
            case 'weapon':
                return this.generateWeaponAttachment(component, entityVar)
            default:
                return `// TODO: attach component ${component.id} of type ${type}`
        }
    }

    private processComponent(component: any, options: BuildOptions): string {
        const componentType = component.data?.componentType || 'custom'
        const componentId = component.id || `component_${Math.random().toString(36).substr(2, 9)}`
        const targetEntity = component.data?.targetEntity || 'default'
        const properties = component.data?.properties || {}

        return `
// MMO Component: ${componentId} (${componentType})
(function() {
    const componentData = {
        id: '${componentId}',
        type: '${componentType}',
        targetEntity: '${targetEntity}',
        properties: ${JSON.stringify(properties)}
    };
    
    ${this.generateComponentLogic(componentType, componentId, properties)}
})();
`
    }

    private generateComponentLogic(type: string, id: string, properties: any): string {
        switch (type) {
            case 'physics':
                return this.generatePhysicsComponent(id, properties)
            case 'networking':
                return this.generateNetworkingComponent(id, properties)
            case 'audio':
                return this.generateAudioComponent(id, properties)
            case 'render':
                return this.generateRenderComponent(id, properties)
            // Universo Platformo | Space MMO components
            case 'inventory':
                return this.generateInventoryComponent(id, properties)
            case 'trading':
                return this.generateTradingComponent(id, properties)
            case 'mineable':
                return this.generateMineableComponent(id, properties)
            case 'portal':
                return this.generatePortalComponent(id, properties)
            case 'weapon':
                return this.generateWeaponComponent(id, properties)
            default:
                return this.generateCustomComponent(id, properties)
        }
    }

    private generatePhysicsComponent(id: string, props: any): string {
        return `
    // Physics component for MMO
    const physicsComponent = {
        mass: ${props.mass || 1},
        friction: ${props.friction || 0.5},
        restitution: ${props.restitution || 0.3},
        
        applyToEntity(entity) {
            entity.addComponent('rigidbody', {
                type: pc.BODYTYPE_DYNAMIC,
                mass: this.mass,
                friction: this.friction,
                restitution: this.restitution
            });
        }
    };
    
    console.log('[MMO Component] Physics component ${id} ready');
`
    }

    private generateNetworkingComponent(id: string, props: any): string {
        return `
    // Networking component for real-time sync
    const networkingComponent = {
        syncRate: ${props.syncRate || 20},
        syncPosition: ${props.syncPosition || true},
        syncRotation: ${props.syncRotation || true},
        
        applyToEntity(entity) {
            entity.networking = {
                lastSync: 0,
                shouldSync: true,
                
                sync() {
                    const now = Date.now();
                    if (now - this.lastSync >= 1000 / networkingComponent.syncRate) {
                        if (window.UniversoGateway?.isConnected) {
                            const syncData = {
                                type: 'entity_sync',
                                entityId: entity.name,
                                timestamp: now
                            };
                            
                            if (networkingComponent.syncPosition) {
                                syncData.position = entity.getLocalPosition();
                            }
                            
                            if (networkingComponent.syncRotation) {
                                syncData.rotation = entity.getLocalEulerAngles();
                            }
                            
                            window.UniversoGateway.send(syncData);
                        }
                        this.lastSync = now;
                    }
                }
            };
        }
    };
    
    console.log('[MMO Component] Networking component ${id} ready');
`
    }

    private generateAudioComponent(id: string, props: any): string {
        return `
    // Audio component for MMO
    const audioComponent = {
        volume: ${props.volume || 1.0},
        loop: ${props.loop || false},
        spatial: ${props.spatial || true},
        
        applyToEntity(entity) {
            entity.addComponent('sound', {
                volume: this.volume,
                loop: this.loop,
                positional: this.spatial,
                distanceModel: pc.DISTANCE_EXPONENTIAL
            });
        }
    };
    
    console.log('[MMO Component] Audio component ${id} ready');
`
    }

    private generateRenderComponent(id: string, props: any): string {
        const safeId = id.replace(/[^a-zA-Z0-9_$]/g, '_')
        return `
    // Render component for MMO
    const renderComponent = {
        primitive: '${props.primitive || 'box'}',
        color: '${props.color || '#ffffff'}',

        applyToEntity(entity) {
            entity.addComponent('model', { type: this.primitive });
            const mcol_${safeId} = new pc.Color();
            mcol_${safeId}.fromString(this.color);
            const mat_${safeId} = new pc.StandardMaterial();
            mat_${safeId}.diffuse = mcol_${safeId};
            mat_${safeId}.update();
            entity.model.material = mat_${safeId};
        }
    };

    console.log('[MMO Component] Render component ${id} ready');
`
    }

    private generateCustomComponent(id: string, props: any): string {
        const safeId = id.replace(/[^a-zA-Z0-9_$]/g, '_')
        return `
    // Custom MMO component
    const customComponent = {
        properties: ${JSON.stringify(props)},

        applyToEntity(entity) {
            entity.customComponent_${safeId} = this.properties;
            console.log('[MMO Component] Custom component ${id} applied to', entity.name);
        }
    };
    
    console.log('[MMO Component] Custom component ${id} ready');
`
    }

    private generateRenderAttachment(component: any, entityVar: string): string {
        const primitive = component.data?.primitive || 'box'
        const color = component.data?.color || '#ffffff'
        const safeId = String(component.id).replace(/[^a-zA-Z0-9_$]/g, '_')
        return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    const col_${safeId} = new pc.Color();
    col_${safeId}.fromString('${color}');
    mat_${safeId}.diffuse = col_${safeId};
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    `
    }

    // Universo Platformo | Space MMO component implementations

    private generateInventoryComponent(id: string, props: any): string {
        return `
    // Inventory component for space ships
    const inventoryComponent = {
        maxCapacity: ${props.maxCapacity || 20}, // m³
        currentLoad: ${props.currentLoad || 0},
        items: ${JSON.stringify(props.items || {})},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                console.log('[Inventory] Added', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);
                return true;
            }
            console.log('[Inventory] Cannot add', amount, itemType, '- Insufficient space');
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];
                console.log('[Inventory] Removed', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);
                return true;
            }
            console.log('[Inventory] Cannot remove', amount, itemType, '- Insufficient quantity');
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        },

        getItemList() {
            return Object.keys(this.items).map(itemType => ({
                type: itemType,
                amount: this.items[itemType]
            }));
        }
    };

    console.log('[MMO Component] Inventory component ${id} ready');
`
    }

    private generateTradingComponent(id: string, props: any): string {
        return `
    // Trading component for stations
    const tradingComponent = {
        pricePerTon: ${props.pricePerTon || 10},
        acceptedItems: ${JSON.stringify(props.acceptedItems || ['asteroidMass'])},
        currency: '${props.currency || 'Inmo'}',
        interactionRange: ${props.interactionRange || 8},

        canTrade(ship, itemType, amount) {
            if (!this.acceptedItems.includes(itemType)) {
                return { success: false, message: 'Item not accepted' };
            }

            if (!ship.inventory || !ship.inventory.items[itemType] || ship.inventory.items[itemType] < amount) {
                return { success: false, message: 'Insufficient items' };
            }

            const distance = entity.getPosition().distance(ship.getPosition());
            if (distance > this.interactionRange) {
                return { success: false, message: 'Ship too far from station' };
            }

            return { success: true };
        },

        executeTrade(ship, itemType, amount) {
            const check = this.canTrade(ship, itemType, amount);
            if (!check.success) return check;

            const payment = amount * this.pricePerTon;

            if (ship.inventory.removeItem(itemType, amount)) {
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;

                console.log('[Trading] Traded', amount, itemType, 'for', payment, this.currency);
                return {
                    success: true,
                    amount: amount,
                    payment: payment,
                    message: 'Trade successful: +' + payment + ' ' + this.currency
                };
            }

            return { success: false, message: 'Trade failed' };
        },

        getTradingInfo() {
            return {
                pricePerTon: this.pricePerTon,
                acceptedItems: this.acceptedItems,
                currency: this.currency,
                interactionRange: this.interactionRange
            };
        }
    };

    console.log('[MMO Component] Trading component ${id} ready');
`
    }

    private generateMineableComponent(id: string, props: any): string {
        return `
    // Mineable component for asteroids
    const mineableComponent = {
        resourceType: '${props.resourceType || 'asteroidMass'}',
        maxYield: ${props.maxYield || 2},
        currentYield: ${props.currentYield || 2},
        hardness: ${props.hardness || 1}, // Damage resistance
        isDestroyed: false,

        onHit(damage = 1) {
            if (this.isDestroyed) return false;

            const actualDamage = damage / this.hardness;
            this.currentYield -= actualDamage;

            console.log('[Mineable] Hit for', actualDamage, 'damage. Remaining:', this.currentYield);

            if (this.currentYield <= 0) {
                this.destroy();
                return true; // Destroyed
            } else {
                this.flashDamage();
                return false; // Still alive
            }
        },

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

            pickup.resourcePickup = {
                resourceType: this.resourceType,
                amount: this.maxYield,

                collect(ship) {
                    if (ship.inventory && ship.inventory.addItem(this.resourceType, this.amount)) {
                        console.log('[Pickup] Collected', this.amount, this.resourceType);
                        pickup.destroy();
                        return true;
                    }
                    return false;
                }
            };

            // Auto-collect on collision
            pickup.collision.on('triggerenter', (otherEntity) => {
                if (otherEntity.shipController) {
                    pickup.resourcePickup.collect(otherEntity);
                }
            });

            app.root.addChild(pickup);

            // Auto-destroy pickup after 30 seconds
            setTimeout(() => {
                if (pickup.parent) pickup.destroy();
            }, 30000);

            // Destroy original entity
            entity.destroy();

            console.log('[Mineable] Destroyed, created pickup');
        },

        flashDamage() {
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(1, 0, 0);
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 200);
            }
        }
    };

    console.log('[MMO Component] Mineable component ${id} ready');
`
    }

    private generatePortalComponent(id: string, props: any): string {
        return `
    // Portal component for gates
    const portalComponent = {
        targetWorld: '${props.targetWorld || 'konkordo'}',
        isActive: ${props.isActive !== false},
        cooldownTime: ${props.cooldownTime || 2000},
        lastUsed: 0,

        setTarget(worldName) {
            this.targetWorld = worldName;
            console.log('[Portal] Target set to:', worldName);
        },

        canUse() {
            const now = Date.now();
            return this.isActive && (now - this.lastUsed >= this.cooldownTime);
        },

        transport(ship) {
            if (!this.canUse()) {
                console.log('[Portal] Portal on cooldown');
                return false;
            }

            this.lastUsed = Date.now();

            console.log('[Portal] Transporting ship to', this.targetWorld);

            // Trigger world change event
            if (window.MMOEvents) {
                window.MMOEvents.emit('world_change', {
                    shipId: ship.name,
                    fromWorld: window.currentWorld || 'kubio',
                    toWorld: this.targetWorld,
                    portalId: '${id}'
                });
            }

            this.flashPortal();
            return true;
        },

        flashPortal() {
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(0, 1, 1);
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 500);
            }
        },

        getPortalInfo() {
            return {
                targetWorld: this.targetWorld,
                isActive: this.isActive,
                cooldownRemaining: Math.max(0, this.cooldownTime - (Date.now() - this.lastUsed))
            };
        }
    };

    console.log('[MMO Component] Portal component ${id} ready');
`
    }

    private generateWeaponComponent(id: string, props: any): string {
        return `
    // Weapon component for ships
    const weaponComponent = {
        fireRate: ${props.fireRate || 2}, // shots per second
        projectileSpeed: ${props.projectileSpeed || 50},
        damage: ${props.damage || 1},
        range: ${props.range || 100},
        canFire: true,
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

            // Position at entity's front
            const entityPos = entity.getPosition();
            const entityForward = entity.forward.clone();
            projectile.setPosition(entityPos.add(entityForward.scale(3)));

            // Apply velocity
            const velocity = direction.clone().scale(this.projectileSpeed);
            projectile.rigidbody.linearVelocity = velocity;

            // Store damage info
            projectile.weaponDamage = this.damage;

            // Add to scene
            app.root.addChild(projectile);

            // Auto-destroy after range/time limit
            const timeToLive = this.range / this.projectileSpeed * 1000;
            setTimeout(() => {
                if (projectile.parent) {
                    projectile.destroy();
                }
            }, timeToLive);

            console.log('[Weapon] Projectile fired with damage:', this.damage);
        },

        getWeaponInfo() {
            return {
                fireRate: this.fireRate,
                damage: this.damage,
                range: this.range,
                canFire: this.canFire
            };
        }
    };

    console.log('[MMO Component] Weapon component ${id} ready');
`
    }

    // Universo Platformo | Attachment methods for space MMO components

    private generateInventoryAttachment(component: any, entityVar: string): string {
        const maxCapacity = component.data?.maxCapacity || 20
        const currentLoad = component.data?.currentLoad || 0
        return `
    // Attach inventory component ${component.id}
    ${entityVar}.inventory = {
        maxCapacity: ${maxCapacity},
        currentLoad: ${currentLoad},
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
    `
    }

    private generateTradingAttachment(component: any, entityVar: string): string {
        const pricePerTon = component.data?.pricePerTon || 10
        const interactionRange = component.data?.interactionRange || 8
        return `
    // Attach trading component ${component.id}
    ${entityVar}.tradingPost = {
        pricePerTon: ${pricePerTon},
        interactionRange: ${interactionRange},

        // Check if ship is in range
        isShipInRange(ship) {
            const distance = ${entityVar}.getPosition().distance(ship.getPosition());
            return distance <= this.interactionRange;
        },

        trade(ship, itemType, amount) {
            if (!this.isShipInRange(ship)) {
                return { success: false, message: 'Ship too far from station' };
            }

            if (ship.inventory && ship.inventory.removeItem(itemType, amount)) {
                const payment = amount * this.pricePerTon;
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;
                return { success: true, payment: payment };
            }

            return { success: false, message: 'Trade failed' };
        },

        getTradingInfo() {
            return {
                pricePerTon: this.pricePerTon,
                interactionRange: this.interactionRange
            };
        }
    };
    `
    }

    private generateMineableAttachment(component: any, entityVar: string): string {
        const resourceType = component.data?.resourceType || 'asteroidMass'
        const maxYield = component.data?.maxYield || 2
        return `
    // Attach mineable component ${component.id}
    ${entityVar}.mineable = {
        resourceType: '${resourceType}',
        maxYield: ${maxYield},
        currentYield: ${maxYield},
        isDestroyed: false,

        onHit(damage = 1) {
            if (this.isDestroyed) return false;

            this.currentYield -= damage;
            if (this.currentYield <= 0) {
                this.destroy();
                return true;
            }
            return false;
        },

        destroy() {
            this.isDestroyed = true;
            // Create pickup logic here
            ${entityVar}.destroy();
        }
    };
    `
    }

    private generatePortalAttachment(component: any, entityVar: string): string {
        const targetWorld = component.data?.targetWorld || 'konkordo'
        const cooldownTime = component.data?.cooldownTime || 2000
        return `
    // Attach portal component ${component.id}
    ${entityVar}.portal = {
        targetWorld: '${targetWorld}',
        cooldownTime: ${cooldownTime},
        lastUsed: 0,

        transport(ship) {
            const now = Date.now();
            if (now - this.lastUsed >= this.cooldownTime) {
                this.lastUsed = now;
                console.log('[Portal] Transporting to', this.targetWorld);
                return true;
            }
            return false;
        }
    };
    `
    }

    private generateWeaponAttachment(component: any, entityVar: string): string {
        const fireRate = component.data?.fireRate || 2
        const damage = component.data?.damage || 1
        return `
    // Attach weapon component ${component.id}
    ${entityVar}.weaponSystem = {
        fireRate: ${fireRate},
        damage: ${damage},
        lastFireTime: 0,

        fire(direction) {
            const now = Date.now();
            if (now - this.lastFireTime >= 1000 / this.fireRate) {
                this.lastFireTime = now;
                // Create projectile logic here
                console.log('[Weapon] Fired with damage:', this.damage);
                return true;
            }
            return false;
        }
    };
    `
    }

}
