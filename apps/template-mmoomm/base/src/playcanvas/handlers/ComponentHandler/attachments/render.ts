// English comments only inside code
function readColorHex(component: any): string {
    return component?.data?.color || component?.data?.inputs?.color || '#ffffff'
}

function readPrimitive(component: any): string {
    return component?.data?.primitive || component?.data?.inputs?.primitive || 'box'
}

export default function renderAttachment(component: any, entityVar: string): string {
    const primitive = readPrimitive(component)
    const color = readColorHex(component)
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
    // Ensure material is applied to all mesh instances
    if (${entityVar}.model && ${entityVar}.model.meshInstances) {
      ${entityVar}.model.meshInstances.forEach(function(mi){ mi.material = mat_${safeId}; });
    }
    // Mark that render component has applied a custom material
    ${entityVar}.__hasRenderComponent = true;
    `
}
