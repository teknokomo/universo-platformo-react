// Universo Platformo | MMOOMM Entity Handler
// Handles Entity nodes with networking capabilities for MMO

import { BuildOptions } from '../../../../../common/types'
import { ComponentHandler } from '../ComponentHandler'
import { generateNetworkComponent } from './utils'
import {
  generatePlayerLogic,
  generateInteractiveLogic,
  generateVehicleLogic,
  generateStaticLogic,
  generateShipLogic,
  generateStationLogic,
  generateAsteroidLogic,
  generateGateLogic,
} from './entityTypes'

const ENTITY_GENERATORS: Record<string, (id: string) => string> = {
  player: generatePlayerLogic,
  interactive: generateInteractiveLogic,
  vehicle: generateVehicleLogic,
  ship: generateShipLogic,
  station: generateStationLogic,
  asteroid: generateAsteroidLogic,
  gate: generateGateLogic,
  static: generateStaticLogic,
}

export class EntityHandler {
  private componentHandler = new ComponentHandler()

  process(entities: any[], options: BuildOptions = {}): string {
    if (!entities || entities.length === 0) return ''
    return entities.map((entity) => this.processEntity(entity, options)).join('\n')
  }

  private processEntity(entity: any, options: BuildOptions): string {
    const entityId = entity.id || `entity_${Math.random().toString(36).substr(2, 9)}`
    const entityType = entity.data?.entityType || 'static'

    // FIXED: Proper transform parsing with fallback for both formats
    const transform = entity.data?.transform || {}
    const position = transform.position || { x: 0, y: 0, z: 0 }
    const rotation = transform.rotation || { x: 0, y: 0, z: 0 }
    const scale = transform.scale || { x: 1, y: 1, z: 1 }

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

    ${isNetworked ? generateNetworkComponent(entityId, entityType) : '// Local entity (not networked)'}

    // Attached components (executed first to allow UPDL overrides)
    ${components.map((c: any) => this.componentHandler.attach(c, 'entity')).join('\n    ')}

    // Entity type specific setup (executed after components)
    ${this.generateEntityTypeLogic(entityType, entityId)}

    // Add to scene
    app.root.addChild(entity);

    // Store reference for networking
    if (!window.MMOEntities) window.MMOEntities = new Map();
    window.MMOEntities.set('${entityId}', entity);

    // ADDED: Debug entity creation
    console.log('[Entity] Created ${entityType} entity:', {
        id: '${entityId}',
        position: entity.getPosition().toString(),
        enabled: entity.enabled,
        hasModel: !!entity.model,
        hasRigidbody: !!entity.rigidbody,
        hasCollision: !!entity.collision,
        inScene: !!entity.parent
    });

    // ADDED: Cleanup handler for memory management
    entity.on('destroy', () => {
        if (window.MMOEntities) {
            window.MMOEntities.delete('${entityId}');
        }
    });
})();
`
  }

  private generateEntityTypeLogic(type: string, id: string): string {
    const generator = ENTITY_GENERATORS[type] || ENTITY_GENERATORS['static']
    return generator(id)
  }
}
