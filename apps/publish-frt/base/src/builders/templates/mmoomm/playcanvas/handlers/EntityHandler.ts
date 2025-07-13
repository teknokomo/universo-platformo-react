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
    
    // Static entities are immovable but can have custom properties
    entity.staticData = {
        isStatic: true,
        entityId: '${id}'
    };
`
    }
}
