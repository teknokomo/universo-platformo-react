export function generateStaticLogic(id: string): string {
    return `
    // Static entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'box' });
    }

    // Collision setup (always needed for static objects)
    entity.addComponent('collision', { type: 'box' });

    // Add default material (only if no custom render component applied)
    if (entity.model && !entity.__hasRenderComponent) {
        const staticMaterial = new pc.StandardMaterial();
        staticMaterial.diffuse.set(0.7, 0.7, 0.7); // Light gray
        staticMaterial.update();
        entity.model.material = staticMaterial;
        if (entity.model && entity.model.meshInstances) {
            entity.model.meshInstances.forEach(function(mi){ mi.material = staticMaterial; });
        }
    }

    // Static entities are immovable but can have custom properties
    entity.staticData = {
        isStatic: true,
        entityId: '${id}'
    };
`;
}
