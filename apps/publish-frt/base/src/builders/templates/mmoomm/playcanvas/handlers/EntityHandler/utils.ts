export function generateNetworkComponent(id: string, type: string): string {
    return `
    // Network synchronization component
    entity.networked = true;
    entity.networkId = '${id}';
    entity.entityType = '${type}';

    // Position sync handler
    entity.on('position:change', (pos) => {
        if (window.UniversoGateway?.isConnected) {
            window.UniversoGateway.send({
                type: 'entity_update',
                id: '${id}',
                position: pos,
                timestamp: Date.now()
            });
        }
    });
    `;
}
