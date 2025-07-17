export function generateStaticLogic(id: string): string {
    return `
    // Static entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('collision', { type: 'box' });

    // Add default material for visibility
    const staticMaterial = new pc.StandardMaterial();
    staticMaterial.diffuse.set(0.7, 0.7, 0.7); // Light gray
    staticMaterial.update();
    entity.model.material = staticMaterial;

    // Static entities are immovable but can have custom properties
    entity.staticData = {
        isStatic: true,
        entityId: '${id}'
    };
`;
}
