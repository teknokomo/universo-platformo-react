export default function renderAttachment(component: any, entityVar: string): string {
    const primitive = component.data?.primitive || 'box';
    const color = component.data?.color || '#ffffff';
    const safeId = String(component.id).replace(/[^a-zA-Z0-9_$]/g, '_');
    return `
    // Render component ${component.id}
    ${entityVar}.addComponent('model', { type: '${primitive}' });
    const mat_${safeId} = new pc.StandardMaterial();
    const col_${safeId} = new pc.Color();
    col_${safeId}.fromString('${color}');
    mat_${safeId}.diffuse = col_${safeId};
    mat_${safeId}.update();
    ${entityVar}.model.material = mat_${safeId};
    `;
}
