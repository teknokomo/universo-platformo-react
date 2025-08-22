export function generatePlayerLogic(id: string): string {
    return `
    // Player entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'capsule' });
    }

    // Physics setup (always needed for player movement)
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_DYNAMIC,
        mass: 70
    });
    entity.addComponent('collision', {
        type: 'capsule',
        radius: 0.5,
        height: 1.8
    });

    // Player controller
    entity.playerController = {
        speed: 5,
        jumpForce: 8,
        isGrounded: false,

        move(direction) {
            if (this.isGrounded) {
                const force = direction.clone().scale(this.speed);
                entity.rigidbody.applyForce(force);
            }
        },

        jump() {
            if (this.isGrounded) {
                entity.rigidbody.applyImpulse(pc.Vec3.UP.clone().scale(this.jumpForce));
                this.isGrounded = false;
            }
        }
    };
`;
}
