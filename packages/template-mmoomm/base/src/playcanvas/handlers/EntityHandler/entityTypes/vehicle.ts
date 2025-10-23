export function generateVehicleLogic(id: string): string {
    return `
    // Vehicle entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'box' });
    }

    // Physics setup (always needed for vehicle movement)
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_DYNAMIC,
        mass: 1000
    });
    entity.addComponent('collision', { type: 'box' });

    // Vehicle controller
    entity.vehicleController = {
        speed: 0,
        maxSpeed: 20,
        acceleration: 5,

        accelerate() {
            this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
            this.updateMovement();
        },

        brake() {
            this.speed = Math.max(this.speed - this.acceleration, 0);
            this.updateMovement();
        },

        updateMovement() {
            const forward = entity.forward.clone().scale(this.speed);
            entity.rigidbody.linearVelocity = forward;
        }
    };
`;
}
