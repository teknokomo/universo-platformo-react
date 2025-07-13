// Universo Platformo | MMOOMM Component Handler
// Handles Component nodes for MMO-specific components

import { BuildOptions } from '../../../../common/types'

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
            default:
                return ''
        }
    }

    private processComponent(component: any, options: BuildOptions): string {
        const componentType = component.data?.componentType || 'custom'
        const componentId = component.data?.id || `component_${Math.random().toString(36).substr(2, 9)}`
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
        return `
    // Render component for MMO
    const renderComponent = {
        primitive: '${props.primitive || 'box'}',
        color: '${props.color || '#ffffff'}',

        applyToEntity(entity) {
            entity.addComponent('model', { type: this.primitive });
            const mcol_${id} = new pc.Color();
            mcol_${id}.fromString(this.color);
            const mat_${id} = new pc.StandardMaterial();
            mat_${id}.diffuse = mcol_${id};
            mat_${id}.update();
            entity.model.material = mat_${id};
        }
    };

    console.log('[MMO Component] Render component ${id} ready');
`
    }

    private generateCustomComponent(id: string, props: any): string {
        return `
    // Custom MMO component
    const customComponent = {
        properties: ${JSON.stringify(props)},
        
        applyToEntity(entity) {
            entity.customComponent_${id} = this.properties;
            console.log('[MMO Component] Custom component ${id} applied to', entity.name);
        }
    };
    
    console.log('[MMO Component] Custom component ${id} ready');
`
    }

    private generateRenderAttachment(component: any, entityVar: string): string {
        const primitive = component.data?.primitive || 'box'
        const color = component.data?.color || '#ffffff'
        return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${component.id} = new pc.StandardMaterial();
    const col_${component.id} = new pc.Color();
    col_${component.id}.fromString('${color}');
    mat_${component.id}.diffuse = col_${component.id};
    mat_${component.id}.update();
    ${entityVar}.model.material = mat_${component.id};
    `
    }
}
