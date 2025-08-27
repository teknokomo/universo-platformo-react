// Universo Platformo | MMOOMM Entity Handler
// Handles Entity nodes with networking capabilities for MMO

import { BuildOptions } from '../../../common/types'
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

    // Robust entity data extraction with fallback to data.inputs
    const data = entity.data || {}
    const inputs = data.inputs || {}

    const entityType = data.entityType || inputs.entityType || 'static'

    // Proper transform parsing with support for string/object/array formats
    const rawTransform = data.transform || inputs.transform
    const norm = safeNormalizeTransform(rawTransform)
    const position = norm.position
    const rotation = norm.rotation
    const scale = norm.scale

    const isNetworked = data.networked || false
    const components = data.components || []

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
    // Diagnostic: log attachments and tradingPost if present (always on for clarity during integration)
    try {
        var compTypes = [];
        try { compTypes = (${JSON.stringify(components)}).map(function(c){ return String((c && ((c.data && (c.data.componentType || (c.data.inputs && c.data.inputs.componentType)))) || 'n/a')).toLowerCase(); }); } catch(_) {}
        var hasMat = !!(entity.model && entity.model.meshInstances && entity.model.meshInstances.some(function(mi){ return !!mi.material; }));
        var tpost = entity.tradingPost;
        console.log('[Entity]', '${entityId}', 'type:${entityType}', 'attached components:', compTypes, 'hasRenderFlag:', !!entity.__hasRenderComponent, 'hasMaterial:', hasMat, 'tradingRange:', tpost ? tpost.interactionRange : 'none');
    } catch (e) { console.warn('[Entity] Debug attachment check failed for ${entityId}', e); }

    // Entity type specific setup (executed after components)
    ${this.generateEntityTypeLogic(entityType, entityId)}

    // Add to scene
    app.root.addChild(entity);

    // Store reference for networking
    if (!window.MMOEntities) window.MMOEntities = new Map();
    window.MMOEntities.set('${entityId}', entity);

    // Optional debug entity creation
    if (window && window.DEBUG_MULTIPLAYER) {
        console.log('[Entity] Created ${entityType} entity:', {
            id: '${entityId}',
            position: entity.getPosition().toString(),
            enabled: entity.enabled,
            hasModel: !!entity.model,
            hasRigidbody: !!entity.rigidbody,
            hasCollision: !!entity.collision,
            inScene: !!entity.parent
        });
    }

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

// English comments only inside code
function safeNormalizeTransform(t: any) {
  let parsed = t
  if (typeof t === 'string') {
    try { parsed = JSON.parse(t) } catch { parsed = undefined }
  }
  const pos = parsed?.pos ?? parsed?.position ?? [0, 0, 0]
  const rot = parsed?.rot ?? parsed?.rotation ?? [0, 0, 0]
  const sc  = parsed?.scale ?? [1, 1, 1]
  const toObj = (v: any, def: number[]) =>
    Array.isArray(v)
      ? { x: +v[0] || def[0], y: +v[1] || def[1], z: +v[2] || def[2] }
      : (v || { x: def[0], y: def[1], z: def[2] })
  return {
    position: toObj(pos, [0, 0, 0]),
    rotation: toObj(rot, [0, 0, 0]),
    scale:    toObj(sc,  [1, 1, 1])
  }
}
