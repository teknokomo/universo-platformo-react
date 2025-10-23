// Universo Platformo | MMOOMM Light Handler
// English comments only inside code

export class LightHandler {
  /**
   * Generate JavaScript for a single light node
   */
  processOne(light: any, _options: any = {}): string {
    const inputs = light?.data?.inputs || light?.data || {}
    const type = String(inputs.type || 'ambient').toLowerCase()
    const color = inputs.color || { r: 1, g: 1, b: 1 }
    const intensity = Number(inputs.intensity ?? 1)

    const toPcColor = (c: any) => `new pc.Color(${Number(c?.r) || 1}, ${Number(c?.g) || 1}, ${Number(c?.b) || 1})`

    if (type === 'ambient') {
      return `// Ambient light (UPDL)
(function(){
  try {
    app.scene.ambientLight = ${toPcColor(color)};
    console.log('[Light] Ambient applied');
  } catch (e) { console.warn('[Light] Ambient failed', e); }
})();`
    }

    if (type === 'directional') {
      const rot = inputs.rotation || { x: 45, y: 30, z: 0 }
      return `// Directional light (UPDL)
(function(){
  try {
    const e = new pc.Entity('light_${light.id || 'dir'}');
    e.addComponent('light', {
      type: pc.LIGHTTYPE_DIRECTIONAL,
      color: ${toPcColor(color)},
      intensity: ${intensity},
      castShadows: false
    });
    e.setEulerAngles(${Number(rot?.x) || 45}, ${Number(rot?.y) || 30}, ${Number(rot?.z) || 0});
    app.root.addChild(e);
    console.log('[Light] Directional added');
  } catch (e) { console.warn('[Light] Directional failed', e); }
})();`
    }

    if (type === 'point') {
      const pos = inputs.position || { x: 0, y: 5, z: 0 }
      const range = Number(inputs.distance ?? 10)
      return `// Point light (UPDL)
(function(){
  try {
    const e = new pc.Entity('light_${light.id || 'pt'}');
    e.addComponent('light', {
      type: pc.LIGHTTYPE_POINT,
      color: ${toPcColor(color)},
      intensity: ${intensity},
      range: ${range}
    });
    e.setPosition(${Number(pos?.x) || 0}, ${Number(pos?.y) || 5}, ${Number(pos?.z) || 0});
    app.root.addChild(e);
    console.log('[Light] Point added');
  } catch (e) { console.warn('[Light] Point failed', e); }
})();`
    }

    if (type === 'spot') {
      const pos = inputs.position || { x: 0, y: 5, z: 0 }
      const rot = inputs.rotation || { x: 45, y: 0, z: 0 }
      const range = Number(inputs.distance ?? 15)
      const inner = Number(inputs.innerConeAngle ?? 20)
      const outer = Number(inputs.outerConeAngle ?? 30)
      return `// Spot light (UPDL)
(function(){
  try {
    const e = new pc.Entity('light_${light.id || 'spot'}');
    e.addComponent('light', {
      type: pc.LIGHTTYPE_SPOT,
      color: ${toPcColor(color)},
      intensity: ${intensity},
      range: ${range},
      innerConeAngle: ${inner},
      outerConeAngle: ${outer}
    });
    e.setPosition(${Number(pos?.x) || 0}, ${Number(pos?.y) || 5}, ${Number(pos?.z) || 0});
    e.setEulerAngles(${Number(rot?.x) || 45}, ${Number(rot?.y) || 0}, ${Number(rot?.z) || 0});
    app.root.addChild(e);
    console.log('[Light] Spot added');
  } catch (e) { console.warn('[Light] Spot failed', e); }
})();`
    }

    // Unknown type: no-op for safety
    return `// Unknown light type: ${type}`
  }
}

