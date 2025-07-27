// Universo Platformo | MMOOMM Embedded Physics System
// Extracts initializePhysics function from PlayCanvasMMOOMMBuilder

import { BaseEmbeddedSystem } from '../htmlSystems/embeddedSystemsTemplate'

/**
 * Interface for embedded physics system
 */
export interface IEmbeddedPhysicsSystem {
    name: string
    generateCode(): string
    getDependencies(): string[]
}

/**
 * Embedded Physics System for MMOOMM template
 * Manages physics initialization for all entities
 */
export class EmbeddedPhysicsSystem extends BaseEmbeddedSystem implements IEmbeddedPhysicsSystem {
    name = 'PhysicsSystem'

    /**
     * Generate initializePhysics JavaScript function code
     */
    generateCode(): string {
        return this.createFunction('initializePhysics()', ` {
            console.log('[Space] Initializing physics for all entities...');

            if (!window.MMOEntities) {
                console.warn('[Space] No MMOEntities found');
                return;
            }

            // Wait for physics system to be ready
            if (!window.app || !window.app.systems || !window.app.systems.rigidbody) {
                console.error('[Space] Physics system not available!');
                return;
            }

            // Ensure physics system is enabled
            if (!window.app.systems.rigidbody.enabled) {
                window.app.systems.rigidbody.enabled = true;
                console.log('[Space] Physics system enabled');
            }

            console.log('[Space] Physics system state:', {
                enabled: window.app.systems.rigidbody.enabled,
                gravity: window.app.systems.rigidbody.gravity,
                hasWorld: !!window.app.systems.rigidbody.dynamicsWorld
            });

            // Initialize physics for all entities
            let physicsCount = 0;
            let errorCount = 0;

            window.MMOEntities.forEach((entity, id) => {
                try {
                    if (!entity) {
                        console.warn('[Space] Null entity found with id:', id);
                        errorCount++;
                        return;
                    }

                    // Check if entity has rigidbody component
                    if (entity.rigidbody) {
                        // Validate rigidbody component
                        if (!entity.rigidbody.enabled) {
                            entity.rigidbody.enabled = true;
                        }

                        // Ensure physics body is created
                        if (!entity.rigidbody.body) {
                            console.warn('[Space] Entity', id, 'has rigidbody component but no physics body');
                            // Try to recreate physics body
                            entity.rigidbody.enabled = false;
                            entity.rigidbody.enabled = true;
                        }

                        physicsCount++;
                        console.log('[Space] Physics initialized for entity:', id, {
                            type: entity.rigidbody.type,
                            mass: entity.rigidbody.mass,
                            hasBody: !!entity.rigidbody.body
                        });
                    } else {
                        // Entity doesn't have rigidbody - this is normal for some entities
                        console.log('[Space] Entity', id, 'has no rigidbody component (normal for UI/effects)');
                    }
                } catch (error) {
                    console.error('[Space] Error initializing physics for entity', id, ':', error);
                    errorCount++;
                }
            });

            console.log('[Space] Physics initialization complete:', {
                totalEntities: window.MMOEntities.size,
                physicsEntities: physicsCount,
                errors: errorCount
            });

            // Validate physics world state
            if (window.app.systems.rigidbody.dynamicsWorld) {
                const world = window.app.systems.rigidbody.dynamicsWorld;
                console.log('[Space] Physics world validation:', {
                    numBodies: world.getNumCollisionObjects ? world.getNumCollisionObjects() : 'unknown',
                    gravity: window.app.systems.rigidbody.gravity.toString()
                });
            }
        }`);
    }

    /**
     * Get system dependencies
     */
    getDependencies(): string[] {
        return []; // Physics system has no dependencies on other embedded systems
    }
}
