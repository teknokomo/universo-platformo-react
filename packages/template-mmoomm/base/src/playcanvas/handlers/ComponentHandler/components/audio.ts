export default function audio(id: string, props: any): string {
    return `
    // Audio component for MMO
    const audioComponent = {
        volume: ${props.volume || 1.0},
        loop: ${props.loop || false},
        spatial: ${props.spatial || true},

        applyToEntity(entity) {
            entity.addComponent('sound', {
                volume: this.volume,
                loop: this.loop,
                positional: this.spatial,
                distanceModel: pc.DISTANCE_EXPONENTIAL
            });
        }
    };

    if (window && window.DEBUG_MULTIPLAYER) console.log('[MMO Component] Audio component ${id} ready');
    `
}
