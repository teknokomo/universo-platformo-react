export default function mineableAttachment(component: any, entityVar: string): string {
    const resourceType = component.data?.resourceType || 'asteroidMass';
    const maxYield = component.data?.maxYield || 2;
    return `
    // Attach mineable component ${component.id}
    ${entityVar}.mineable = {
        resourceType: '${resourceType}',
        maxYield: ${maxYield},
        currentYield: ${maxYield},
        isDestroyed: false,

        onHit(damage = 1) {
            if (this.isDestroyed) return false;

            this.currentYield -= damage;
            if (this.currentYield <= 0) {
                this.destroy();
                return true;
            }
            return false;
        },

        destroy() {
            this.isDestroyed = true;
            // Create pickup logic here
            ${entityVar}.destroy();
        }
    };
    `;
}
