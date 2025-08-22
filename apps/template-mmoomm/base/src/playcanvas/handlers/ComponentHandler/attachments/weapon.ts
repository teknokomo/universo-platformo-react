export default function weaponAttachment(component: any, entityVar: string): string {
    const fireRate = component.data?.fireRate || 2;
    const damage = component.data?.damage || 1;
    return `
    // Attach weapon component ${component.id}
    ${entityVar}.weaponSystem = {
        fireRate: ${fireRate},
        damage: ${damage},
        lastFireTime: 0,

        fire(direction) {
            const now = Date.now();
            if (now - this.lastFireTime >= 1000 / this.fireRate) {
                this.lastFireTime = now;
                // Create projectile logic here
                console.log('[Weapon] Fired with damage:', this.damage);
                return true;
            }
            return false;
        }
    };
    `;
}
