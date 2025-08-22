// Universo Platformo | MMOOMM Space Handler
// Handles Space nodes for MMO environments with multi-scene support

import { BuildOptions } from '../../../common/types'

export class SpaceHandler {
    /**
     * Process Space nodes for MMO environment
     * Space in MMOOMM can be: root, region, instance
     */
    process(space: any, options: BuildOptions = {}): string {
        if (!space) return ''

        const spaceType = space.data?.spaceType || 'root'
        const spaceName = space.data?.spaceName || 'default-space'
        const maxPlayers = space.data?.maxPlayers || 10
        const backgroundColor = space.data?.backgroundColor || '#000011'

        return this.generateSpaceScript(spaceType, spaceName, maxPlayers, backgroundColor, options)
    }

    private generateSpaceScript(type: string, spaceName: string, maxPlayers: number, backgroundColor: string, options: BuildOptions): string {
        if (type === 'root') {
            return `
// Root Space - Main MMO container
window.MMOSpace = {
    id: '${spaceName}',
    name: '${spaceName}',
    type: '${type}',
    maxPlayers: ${maxPlayers},
    currentPlayers: 0,
    backgroundColor: '${backgroundColor}',
    regions: new Map(),

    // Initialize space
    init() {
        console.log('[MMO Space] Initializing root space:', this.name);
        this.setupEnvironment();
        this.setupNetworking();
    },

    // IMPROVED: Environment setup with proper lighting
    setupEnvironment() {
        // Set background color
        if (app.scene.skybox) {
            app.scene.skybox = null; // Disable skybox for solid color
        }

        // Set clear color from space configuration
        const color = new pc.Color();
        color.fromString(this.backgroundColor);

        // Set camera clear color
        if (app.root.findByName('Camera')) {
            const camera = app.root.findByName('Camera');
            if (camera.camera) {
                camera.camera.clearColor = color;
            }
        }

        // IMPROVED: Better ambient lighting for space
        const ambientColor = new pc.Color(0.3, 0.3, 0.4); // Soft blue ambient
        app.scene.ambientLight = ambientColor;

        // ADDED: Create directional light for better visibility
        const lightEntity = new pc.Entity('DirectionalLight');
        lightEntity.addComponent('light', {
            type: pc.LIGHTTYPE_DIRECTIONAL,
            color: new pc.Color(1, 1, 0.9),
            intensity: 1.5,
            castShadows: false
        });
        lightEntity.setEulerAngles(45, 30, 0);
        app.root.addChild(lightEntity);

        console.log('[MMO Space] Environment setup complete for', this.name);
    },

    // Network setup for real-time synchronization
    setupNetworking() {
        // WebSocket connection will be handled by UniversoHandler
        console.log('[MMO Space] Network setup ready for Universo gateway');
    },

    // ADDED: World switching functionality
    switchWorld(targetWorld) {
        console.log('[MMO Space] Switching from', this.name, 'to', targetWorld);

        // Cleanup current world entities
        this.cleanup();

        // Trigger world reload (this would be handled by portal system)
        if (window.MMOEvents) {
            window.MMOEvents.emit('world_switch_complete', {
                from: this.name,
                to: targetWorld
            });
        }
    },

    // ADDED: Cleanup for world switching
    cleanup() {
        // Clear all entities except player ship
        if (window.MMOEntities) {
            window.MMOEntities.forEach((entity, id) => {
                if (!entity.shipController) { // Keep player ship
                    entity.destroy();
                    window.MMOEntities.delete(id);
                }
            });
        }

        // Clear projectiles
        if (window.activeProjectiles) {
            window.activeProjectiles.forEach(projectile => {
                if (projectile.parent) projectile.destroy();
            });
            window.activeProjectiles.clear();
        }

        console.log('[MMO Space] World cleanup complete');
    }
};

// Initialize space when script loads
if (typeof window !== 'undefined') {
    window.MMOSpace.init();
}
`
        }

        return `// Space: ${spaceName} (${type})\n`
    }
}
