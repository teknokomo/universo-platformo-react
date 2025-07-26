// BACKUP: Original weaponSystem implementation before laser mining system
// Date: 2025-01-24
// This file contains the original projectile-based weapon system for rollback purposes

const originalWeaponSystem = {
    canFire: true,
    fireRate: 2, // shots per second
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
        // IMPROVED: Memory-managed projectile creation
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

        // ADDED: Track projectiles for cleanup
        if (!window.activeProjectiles) window.activeProjectiles = new Set();
        window.activeProjectiles.add(projectile);

        // Position projectile at ship's front
        const shipPos = entity.getPosition();
        const shipForward = entity.forward.clone();
        projectile.setPosition(shipPos.add(shipForward.scale(3)));

        // Apply velocity
        const velocity = direction.clone().scale(50);
        projectile.rigidbody.linearVelocity = velocity;

        // Add to scene
        app.root.addChild(projectile);

        // IMPROVED: Auto-destroy with cleanup after 5 seconds
        setTimeout(() => {
            if (projectile.parent) {
                if (window.activeProjectiles) {
                    window.activeProjectiles.delete(projectile);
                }
                projectile.destroy();
            }
        }, 5000);

        console.log('[Ship] Projectile fired from', '${id}');
    }
};

// Original SpaceControls fireWeapon method
const originalFireWeapon = function() {
    const ship = window.playerShip;
    if (ship && ship.weaponSystem) {
        const forward = ship.forward.clone();
        ship.weaponSystem.fire(forward);
    }
};

// Original asteroid collision handling
const originalAsteroidCollision = function(entity) {
    entity.collision.on('collisionstart', (result) => {
        const otherEntity = result.other;
        if (otherEntity.name && otherEntity.name.startsWith('projectile_')) {
            entity.mineable.onHit(otherEntity);

            // IMPROVED: Cleanup projectile from tracking
            if (window.activeProjectiles) {
                window.activeProjectiles.delete(otherEntity);
            }
            otherEntity.destroy();
        }
    });
};

module.exports = {
    originalWeaponSystem,
    originalFireWeapon,
    originalAsteroidCollision
};
