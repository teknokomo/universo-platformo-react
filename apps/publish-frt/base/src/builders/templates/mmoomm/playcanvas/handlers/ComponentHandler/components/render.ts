export default function render(id: string, props: any): string {
    const safeId = id.replace(/[^a-zA-Z0-9_$]/g, '_');
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
