export function generateInteractiveLogic(id: string): string {
    return `
    // Interactive entity setup
    entity.addComponent('model', { type: 'box' });
    entity.addComponent('collision', { type: 'box' });

    // Interaction handler
    entity.interaction = {
        canInteract: true,
        onInteract(player) {
            console.log('[MMO] Player', player.name, 'interacted with', '${id}');

            // Broadcast interaction to network
            if (window.UniversoGateway?.isConnected) {
                window.UniversoGateway.send({
                    type: 'entity_interaction',
                    entityId: '${id}',
                    playerId: player.networkId,
                    timestamp: Date.now()
                });
            }
        }
    };
`;
}
