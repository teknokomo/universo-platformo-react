// Universo Platformo | MMOOMM Embedded Helper Functions
// Extracts trading and initialization functions from PlayCanvasMMOOMMBuilder

import { BaseEmbeddedSystem } from '../htmlSystems/embeddedSystemsTemplate'

/**
 * Interface for embedded helper functions
 */
export interface IEmbeddedHelperFunctions {
    name: string
    generateCode(): string
    getDependencies(): string[]
}

/**
 * Embedded Helper Functions for MMOOMM template
 * Manages trading functions and initialization helpers
 */
export class EmbeddedHelperFunctions extends BaseEmbeddedSystem implements IEmbeddedHelperFunctions {
    name = 'HelperFunctions'

    /**
     * Generate helper functions JavaScript code
     */
    generateCode(): string {
        const tradingFunctions = this.generateTradingFunctions()
        const initializationFunctions = this.generateInitializationFunctions()
        
        return `${tradingFunctions}

${initializationFunctions}`
    }

    /**
     * Generate trading functions
     */
    private generateTradingFunctions(): string {
        return `        // Trading functions
        function tradeAll() {
            const ship = window.playerShip;
            const station = ship?.nearStation;

            if (ship && station && ship.inventory) {
                const items = ship.inventory.getItemList();
                items.forEach(item => {
                    if (item.type === 'asteroidMass') {
                        station.tradingPost.trade(ship, item.type, item.amount);
                    }
                });
                
                if (window.SpaceHUD && window.SpaceHUD.updateShipStatus) {
                    window.SpaceHUD.updateShipStatus(ship);
                }
                
                console.log('[Trading] Traded all asteroid mass');
            } else {
                console.warn('[Trading] Cannot trade - missing ship, station, or inventory');
            }
        }

        function tradeHalf() {
            const ship = window.playerShip;
            const station = ship?.nearStation;

            if (ship && station && ship.inventory && ship.inventory.items.asteroidMass) {
                const amount = ship.inventory.items.asteroidMass / 2;
                station.tradingPost.trade(ship, 'asteroidMass', amount);
                
                if (window.SpaceHUD && window.SpaceHUD.updateShipStatus) {
                    window.SpaceHUD.updateShipStatus(ship);
                }
                
                console.log('[Trading] Traded half asteroid mass:', amount);
            } else {
                console.warn('[Trading] Cannot trade half - missing requirements or no asteroid mass');
            }
        }

        function closeTrade() {
            if (window.SpaceHUD && window.SpaceHUD.hideTradingPanel) {
                window.SpaceHUD.hideTradingPanel();
                console.log('[Trading] Trading panel closed');
            }
        }`
    }

    /**
     * Generate initialization functions
     */
    private generateInitializationFunctions(): string {
        return `        // Initialization functions
        function initializeSpaceControls() {
            console.log('[Space] Initializing SpaceControls...');

            // Check if SpaceControls exists
            if (!window.SpaceControls) {
                console.error('[Space] SpaceControls not found!');
                return;
            }

            console.log('[Space] SpaceControls found, calling init()');
            window.SpaceControls.init();
            console.log('[Space] SpaceControls.init() completed');

            // Find player ship
            console.log('[Space] Looking for player ship...');

            // Initialize MMOEntities if not exists
            if (!window.MMOEntities) {
                window.MMOEntities = new Map();
                console.log('[Space] Initialized empty MMOEntities map');
            }

            if (window.MMOEntities.size > 0) {
                console.log('[Space] Total entities found:', window.MMOEntities.size);

                window.MMOEntities.forEach((entity, id) => {
                    console.log('[Space] Entity', id, 'components:', {
                        hasModel: !!entity.model,
                        hasShipController: !!entity.shipController,
                        hasRigidbody: !!entity.rigidbody,
                        position: entity.getPosition().toString(),
                        visible: entity.enabled
                    });

                    if (entity.shipController) {
                        window.playerShip = entity;
                        console.log('[Space] Player ship found:', id);
                    }
                });
            } else {
                console.log('[Space] No entities created yet');
            }

            if (!window.playerShip) {
                console.warn('[Space] No player ship found! Check entity creation.');
            } else {
                console.log('[Space] Player ship successfully assigned at position:', window.playerShip.getPosition().toString());
            }

            // Initialize physics after a short delay to ensure scene is fully loaded
            setTimeout(() => {
                if (typeof initializePhysics === 'function') {
                    initializePhysics();
                } else {
                    console.warn('[Space] initializePhysics function not found');
                }
            }, 500);
        }

        // Update HUD every second (moved after app.start())
        function startHUDUpdates() {
            console.log('[Space] Starting HUD update loop...');
            
            setInterval(() => {
                if (window.playerShip && window.SpaceHUD) {
                    if (window.SpaceHUD.updateShipStatus) {
                        window.SpaceHUD.updateShipStatus(window.playerShip);
                    }
                    if (window.SpaceHUD.updateMiniMap) {
                        window.SpaceHUD.updateMiniMap();
                    }
                }
            }, 1000);
            
            console.log('[Space] HUD update loop started');
        }`
    }

    /**
     * Get system dependencies
     */
    getDependencies(): string[] {
        return ['SpaceHUD', 'SpaceControls', 'PhysicsSystem']; // Depends on all other systems
    }
}
