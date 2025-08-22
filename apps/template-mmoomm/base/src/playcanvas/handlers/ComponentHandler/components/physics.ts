export default function physics(id: string, props: any): string {
    return `
    // Physics component for MMO
    const physicsComponent = {
        mass: ${props.mass || 1},
        friction: ${props.friction || 0.5},
        restitution: ${props.restitution || 0.3},

        applyToEntity(entity) {
            entity.addComponent('rigidbody', {
                type: pc.BODYTYPE_DYNAMIC,
                mass: this.mass,
                friction: this.friction,
                restitution: this.restitution
            });
        }
    };

    if (window && window.DEBUG_MULTIPLAYER) console.log('[MMO Component] Physics component ${id} ready');
    `
}
