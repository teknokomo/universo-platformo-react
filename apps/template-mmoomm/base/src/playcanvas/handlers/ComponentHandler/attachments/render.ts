// English comments only inside code
function readPrimitive(component: any): string {
    return component?.primitive || 'box'
}

// Pick color from sources prioritizing new top-level fields
function pickColorSource(component: any): any {
    const top = component || {}
    const p = component?.props || {}
    return top.color ?? p.color ?? (p.material && p.material.color) ?? '#ffffff'
}

function isHexColor(value: any): boolean {
    return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

// Accept 8-digit HEX (#RRGGBBAA) and rgb/rgba strings
function parseExtendedColorString(value: any): { r: number; g: number; b: number } | null {
    if (typeof value !== 'string') return null
    // #RRGGBBAA -> use first 6 digits
    const hex8 = /^#([0-9a-fA-F]{8})$/
    const m8 = value.match(hex8)
    if (m8) {
        const rr = parseInt(m8[1].slice(0, 2), 16) / 255
        const gg = parseInt(m8[1].slice(2, 4), 16) / 255
        const bb = parseInt(m8[1].slice(4, 6), 16) / 255
        return { r: rr, g: gg, b: bb }
    }
    // rgb() or rgba()
    const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i
    const mr = value.match(rgb)
    if (mr) {
        const rr = Math.min(255, Math.max(0, parseInt(mr[1], 10))) / 255
        const gg = Math.min(255, Math.max(0, parseInt(mr[2], 10))) / 255
        const bb = Math.min(255, Math.max(0, parseInt(mr[3], 10))) / 255
        return { r: rr, g: gg, b: bb }
    }
    return null
}

// Normalize {r,g,b} (0..1 or 0..255) to 0..1 floats
function normalizeRgbObject(obj: any): { r: number; g: number; b: number } {
    const r = Number(obj.r); const g = Number(obj.g); const b = Number(obj.b)
    const clamp01 = (v: number) => (v > 1 ? Math.min(255, Math.max(0, v)) / 255 : Math.max(0, Math.min(1, v)))
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b) }
}

export default function renderAttachment(component: any, entityVar: string): string {
    const primitive = readPrimitive(component)
    const colorSrc = pickColorSource(component)
    const safeId = String(component.id).replace(/[^a-zA-Z0-9_$]/g, '_')

    // Case 1: Hex color string (#rgb or #rrggbb)
    if (isHexColor(colorSrc)) {
        return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    const col_${safeId} = new pc.Color();
    col_${safeId}.fromString('${String(colorSrc)}');
    mat_${safeId}.diffuse = col_${safeId};
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    if (${entityVar}.model && ${entityVar}.model.meshInstances) {
      ${entityVar}.model.meshInstances.forEach(function(mi){ mi.material = mat_${safeId}; });
    }
    ${entityVar}.__hasRenderComponent = true;
    if (typeof window !== 'undefined' && (window && (window.DEBUG_MULTIPLAYER || window.DEBUG_RENDER))) {
      console.log('[RenderAttachment] Applied HEX color to ${entityVar}:', '${String(colorSrc)}', 'primitive:', '${primitive}');
    }
    `
    }

    // Case 2: #rrggbbaa or rgb()/rgba() strings
    const ext = parseExtendedColorString(colorSrc)
    if (ext) {
        return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    mat_${safeId}.diffuse.set(${ext.r}, ${ext.g}, ${ext.b});
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    if (${entityVar}.model && ${entityVar}.model.meshInstances) {
      ${entityVar}.model.meshInstances.forEach(function(mi){ mi.material = mat_${safeId}; });
    }
    ${entityVar}.__hasRenderComponent = true;
    if (typeof window !== 'undefined' && (window && (window.DEBUG_MULTIPLAYER || window.DEBUG_RENDER))) {
      console.log('[RenderAttachment] Applied EXT color to ${entityVar}:', { r: ${ext.r}, g: ${ext.g}, b: ${ext.b} }, 'primitive:', '${primitive}');
    }
    `
    }

    // Case 3: { r, g, b }
    if (colorSrc && typeof colorSrc === 'object' && 'r' in colorSrc && 'g' in colorSrc && 'b' in colorSrc) {
        const rgb = normalizeRgbObject(colorSrc)
        return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    mat_${safeId}.diffuse.set(${rgb.r}, ${rgb.g}, ${rgb.b});
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    if (${entityVar}.model && ${entityVar}.model.meshInstances) {
      ${entityVar}.model.meshInstances.forEach(function(mi){ mi.material = mat_${safeId}; });
    }
    ${entityVar}.__hasRenderComponent = true;
    if (typeof window !== 'undefined' && (window && (window.DEBUG_MULTIPLAYER || window.DEBUG_RENDER))) {
      console.log('[RenderAttachment] Applied RGB color to ${entityVar}:', { r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} }, 'primitive:', '${primitive}');
    }
    `
    }

    // Fallback: default white
    return `
    // Render component ${component.id} (fallback color)
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    const col_${safeId} = new pc.Color(); col_${safeId}.fromString('#ffffff');
    mat_${safeId}.diffuse = col_${safeId};
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    if (${entityVar}.model && ${entityVar}.model.meshInstances) {
      ${entityVar}.model.meshInstances.forEach(function(mi){ mi.material = mat_${safeId}; });
    }
    ${entityVar}.__hasRenderComponent = true;
    if (typeof window !== 'undefined' && (window && (window.DEBUG_MULTIPLAYER || window.DEBUG_RENDER))) {
      console.warn('[RenderAttachment] Fallback color applied to ${entityVar} (no valid color found). Primitive:', '${primitive}');
    }
    `
}
