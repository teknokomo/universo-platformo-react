export default function weapon(id: string, props: any): string {
    return `
    // Weapon component for ships
    const weaponComponent = {
        fireRate: ${props.fireRate || 2}, // shots per second
        projectileSpeed: ${props.projectileSpeed || 50},
        damage: ${props.damage || 1},
        range: ${props.range || 100},
        canFire: true,
        lastFireTime: 0,

        fire(direction) {
            const now = Date.now();
            if (this.canFire && now - this.lastFireTime >= 1000 / this.fireRate) {
                this.createProjectile(direction);
                this.lastFireTime = now;
                return true;
            }
            return false;
        },

        createProjectile(direction) {
            const projectile = new pc.Entity('projectile_' + Date.now());
            projectile.addComponent('model', { type: 'sphere' });
            projectile.addComponent('rigidbody', {
                type: pc.BODYTYPE_DYNAMIC,
                mass: 0.1
            });
            projectile.addComponent('collision', {
                type: 'sphere',
                radius: 0.1
            });

            // Position at entity's front
            const entityPos = entity.getPosition();
            const entityForward = entity.forward.clone();
            projectile.setPosition(entityPos.add(entityForward.scale(3)));

            // Apply velocity
            const velocity = direction.clone().scale(this.projectileSpeed);
            projectile.rigidbody.linearVelocity = velocity;

            // Store damage info
            projectile.weaponDamage = this.damage;

            // Add to scene
            app.root.addChild(projectile);

            // Auto-destroy after range/time limit
            const timeToLive = this.range / this.projectileSpeed * 1000;
            setTimeout(() => {
                if (projectile.parent) {
                    projectile.destroy();
                }
            }, timeToLive);

            console.log('[Weapon] Projectile fired with damage:', this.damage);
        },

        getWeaponInfo() {
            return {
                fireRate: this.fireRate,
                damage: this.damage,
                range: this.range,
                canFire: this.canFire
            };
        }
    };

    if (window && window.DEBUG_MULTIPLAYER) console.log('[MMO Component] Weapon component ${id} ready');
    `
}
