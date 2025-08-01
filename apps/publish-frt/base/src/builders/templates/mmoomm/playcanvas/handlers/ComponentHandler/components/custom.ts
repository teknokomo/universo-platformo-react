export default function custom(id: string, props: any): string {
    const safeId = id.replace(/[^a-zA-Z0-9_$]/g, '_');
    return `
    // Custom MMO component
    const customComponent = {
        properties: ${JSON.stringify(props)},

        applyToEntity(entity) {
            entity.customComponent_${safeId} = this.properties;
            console.log('[MMO Component] Custom component ${id} applied to', entity.name);
        }
    };

    console.log('[MMO Component] Custom component ${id} ready');
    `
}
