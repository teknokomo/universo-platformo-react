export default function networking(id: string, props: any): string {
    return `
    // Networking component for real-time sync
    const networkingComponent = {
        syncRate: ${props.syncRate || 20},
        syncPosition: ${props.syncPosition || true},
        syncRotation: ${props.syncRotation || true},

        applyToEntity(entity) {
            entity.networking = {
                lastSync: 0,
                shouldSync: true,

                sync() {
                    const now = Date.now();
                    if (now - this.lastSync >= 1000 / networkingComponent.syncRate) {
                        if (window.UniversoGateway?.isConnected) {
                            const syncData = {
                                type: 'entity_sync',
                                entityId: entity.name,
                                timestamp: now
                            };

                            if (networkingComponent.syncPosition) {
                                syncData.position = entity.getLocalPosition();
                            }

                            if (networkingComponent.syncRotation) {
                                syncData.rotation = entity.getLocalEulerAngles();
                            }

                            window.UniversoGateway.send(syncData);
                        }
                        this.lastSync = now;
                    }
                }
            };
        }
    };

    console.log('[MMO Component] Networking component ${id} ready');
    `
}
